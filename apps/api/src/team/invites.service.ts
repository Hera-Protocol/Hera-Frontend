import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  type AcceptInviteInput,
  type CreateInviteInput,
  type InviteDto,
  type InviteLookupResponse,
  passwordSchema,
} from "@hera/core";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { AuthService, type SessionResult } from "../auth/auth.service";
import { PasswordService } from "../auth/password.service";
import { actorOf, type UserPrincipal } from "../auth/principal";
import { SessionsService } from "../auth/sessions.service";
import { hashToken, newToken } from "../auth/tokens";
import { ApiError, conflict, notFound, validationFailed } from "../common/api-error";
import { toIso } from "../common/query";
import { DATABASE, type Database, isUniqueViolation } from "../db/database";
import { invites, memberships, orgs, users } from "../db/schema";
import { MailerService } from "../mail/mailer.service";
import { teamInvite } from "../mail/templates";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InviteRow = typeof invites.$inferSelect;

function toDto(row: InviteRow): InviteDto {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    invitedBy: row.invitedByName,
    expiresAt: row.expiresAt.toISOString(),
    ...(row.acceptedAt ? { acceptedAt: toIso(row.acceptedAt) } : {}),
    ...(row.revokedAt ? { revokedAt: toIso(row.revokedAt) } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

const isOpen = (row: InviteRow, now = new Date()) => !row.acceptedAt && !row.revokedAt && row.expiresAt > now;

const inviteExpired = () => new ApiError(HttpStatus.GONE, "invite_expired", "This invite has expired or was revoked. Ask for a new one.");
const alreadyMember = () => conflict("already_member", "That person is already a member of this organization.");
const invalidCredentials = () =>
  new ApiError(HttpStatus.UNAUTHORIZED, "invalid_credentials", "That password doesn't match the account for this email.");

@Injectable()
export class InvitesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly mailer: MailerService,
  ) {}

  async list(orgId: string): Promise<InviteDto[]> {
    const rows = await this.db.select().from(invites).where(eq(invites.orgId, orgId)).orderBy(desc(invites.createdAt));
    return rows.map(toDto);
  }

  async create(user: UserPrincipal, input: CreateInviteInput): Promise<InviteDto> {
    const token = newToken();
    const { row, orgName } = await this.db.transaction(async (tx) => {
      // Serialise invites per org so two admins can't double-invite the same address.
      const [org] = await tx.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, user.orgId)).for("update");
      const [member] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.orgId, user.orgId), eq(users.email, input.email)))
        .limit(1);
      if (member) throw alreadyMember();
      const [pending] = await tx
        .select({ id: invites.id })
        .from(invites)
        .where(
          and(eq(invites.orgId, user.orgId), eq(invites.email, input.email), isNull(invites.acceptedAt), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())),
        )
        .limit(1);
      if (pending) throw conflict("invite_pending", "That email already has a pending invite. Resend it instead.");

      const [row] = await tx
        .insert(invites)
        .values({
          orgId: user.orgId,
          email: input.email,
          role: input.role,
          tokenHash: hashToken(token),
          invitedBy: user.userId,
          invitedByName: user.name,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        })
        .returning();
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "invite.created", target: row!.id, metadata: { email: input.email, role: input.role } },
        tx,
      );
      return { row: row!, orgName: org!.name };
    });
    this.sendInvite(row, orgName, token);
    return toDto(row);
  }

  async revoke(user: UserPrincipal, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(invites)
        .where(and(eq(invites.id, id), eq(invites.orgId, user.orgId)))
        .for("update");
      if (!row) throw notFound("That invite");
      if (row.acceptedAt) throw conflict("invite_accepted", "That invite was already accepted. Remove the member instead.");
      if (row.revokedAt) return; // idempotent
      await tx.update(invites).set({ revokedAt: new Date() }).where(eq(invites.id, id));
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "invite.revoked", target: id, metadata: { email: row.email, role: row.role } },
        tx,
      );
    });
  }

  /** A new token and a fresh 7 days. The previous link stops working. */
  async resend(user: UserPrincipal, id: string): Promise<InviteDto> {
    const token = newToken();
    const { row, orgName } = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(invites)
        .where(and(eq(invites.id, id), eq(invites.orgId, user.orgId)))
        .for("update");
      if (!current) throw notFound("That invite");
      if (current.acceptedAt) throw conflict("invite_accepted", "That invite was already accepted.");
      if (current.revokedAt) throw conflict("invite_revoked", "That invite was revoked. Send a new one.");
      const [row] = await tx
        .update(invites)
        .set({ tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) })
        .where(eq(invites.id, id))
        .returning();
      const [org] = await tx.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, user.orgId));
      await this.audit.record({ orgId: user.orgId, actor: actorOf(user), action: "invite.resent", target: id, metadata: { email: current.email } }, tx);
      return { row: row!, orgName: org!.name };
    });
    this.sendInvite(row, orgName, token);
    return toDto(row);
  }

  async lookup(token: string): Promise<InviteLookupResponse> {
    const [found] = await this.db
      .select({ invite: invites, orgName: orgs.name })
      .from(invites)
      .innerJoin(orgs, eq(orgs.id, invites.orgId))
      .where(eq(invites.tokenHash, hashToken(token)))
      .limit(1);
    if (!found) throw notFound("That invite");
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, found.invite.email)).limit(1);
    return {
      email: found.invite.email,
      orgName: found.orgName,
      role: found.invite.role,
      invitedBy: found.invite.invitedByName,
      existingUser: Boolean(existing),
      expired: !isOpen(found.invite),
    };
  }

  async accept(input: AcceptInviteInput): Promise<SessionResult> {
    const [invite] = await this.db.select().from(invites).where(eq(invites.tokenHash, hashToken(input.token))).limit(1);
    if (!invite) throw notFound("That invite");
    if (!isOpen(invite)) throw inviteExpired();

    const [existing] = await this.db.select().from(users).where(eq(users.email, invite.email)).limit(1);
    let passwordHash: string | undefined;
    if (existing) {
      if (!(await this.passwords.verify(existing.passwordHash, input.password))) throw invalidCredentials();
    } else {
      const fields: Record<string, string> = {};
      if (!input.name) fields.name = "Tell us your name";
      const password = passwordSchema.safeParse(input.password);
      if (!password.success) fields.password = password.error.issues[0]?.message ?? "Choose a stronger password";
      if (Object.keys(fields).length) throw validationFailed(fields);
      passwordHash = await this.passwords.hash(input.password);
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [locked] = await tx.select().from(invites).where(eq(invites.id, invite.id)).for("update");
        if (!locked || !isOpen(locked)) throw inviteExpired();
        const now = new Date();

        let userId: string;
        let email: string;
        if (existing) {
          userId = existing.id;
          email = existing.email;
          // The token arrived in their inbox, which proves the address.
          if (!existing.emailVerifiedAt) await tx.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, existing.id));
          const [member] = await tx
            .select({ id: memberships.id })
            .from(memberships)
            .where(and(eq(memberships.userId, existing.id), eq(memberships.orgId, invite.orgId)))
            .limit(1);
          if (member) throw alreadyMember();
        } else {
          const [created] = await tx
            .insert(users)
            .values({ email: invite.email, name: input.name!, passwordHash: passwordHash!, emailVerifiedAt: now })
            .returning();
          userId = created!.id;
          email = created!.email;
        }

        await tx.insert(memberships).values({ userId, orgId: invite.orgId, role: invite.role });
        await tx.update(invites).set({ acceptedAt: now }).where(eq(invites.id, invite.id));
        await this.audit.record(
          { orgId: invite.orgId, actor: email, action: "invite.accepted", target: invite.id, metadata: { userId, email, role: invite.role, newUser: !existing } },
          tx,
        );
        const token = await this.sessions.create(userId, invite.orgId, tx);
        return { token, me: await this.auth.me(userId, invite.orgId, tx) };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("email_taken", "An account with that email was just created. Sign in and accept again.");
      throw error;
    }
  }

  private sendInvite(row: InviteRow, orgName: string, token: string): void {
    const url = this.mailer.link("/invite", { token });
    this.mailer.sendLater(row.email, teamInvite({ inviter: row.invitedByName, orgName, role: row.role, url }));
  }
}
