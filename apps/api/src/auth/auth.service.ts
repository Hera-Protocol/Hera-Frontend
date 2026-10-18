import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import type { LoginInput, MeResponse, MembershipDto, ResetPasswordInput, SignupInput } from "@hera/core";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { ApiError, conflict, forbidden, notFound, validationFailed } from "../common/api-error";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { DATABASE, type Database, type Executor, isUniqueViolation } from "../db/database";
import { emailVerifications, memberships, orgs, passwordResets, users } from "../db/schema";
import { MailerService } from "../mail/mailer.service";
import { passwordReset, verifyEmail } from "../mail/templates";
import { PasswordService } from "./password.service";
import type { UserPrincipal } from "./principal";
import { SessionsService } from "./sessions.service";
import { hashToken, newToken } from "./tokens";

const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

const invalidCredentials = () =>
  new ApiError(HttpStatus.UNAUTHORIZED, "invalid_credentials", "That email and password don't match an account.");
const emailTaken = () => conflict("email_taken", "An account with that email already exists. Sign in instead.");

export interface SessionResult {
  token: string;
  me: MeResponse;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger("Auth");

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
  ) {}

  async signup(input: SignupInput): Promise<SessionResult> {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing) throw emailTaken();
    const passwordHash = await this.passwords.hash(input.password);

    try {
      const { result, verifyToken } = await this.db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({ email: input.email, name: input.name, passwordHash }).returning();
        const [org] = await tx.insert(orgs).values({ name: input.company, plan: input.plan }).returning();
        await tx.insert(memberships).values({ userId: user!.id, orgId: org!.id, role: "owner" });
        await this.audit.record(
          { orgId: org!.id, actor: user!.email, action: "user.signup", target: user!.id, metadata: { plan: input.plan } },
          tx,
        );
        const verifyToken = await this.issueVerification(user!.id, tx);
        const token = await this.sessions.create(user!.id, org!.id, tx);
        return { verifyToken, result: { token, me: await this.me(user!.id, org!.id, tx) } };
      });
      this.sendVerification(result.me.user, verifyToken);
      return result;
    } catch (error) {
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  }

  async login(input: LoginInput, ip: string | undefined): Promise<SessionResult> {
    const [user] = await this.db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const ok = user ? await this.passwords.verify(user.passwordHash, input.password) : await this.passwords.verifyDummy(input.password);
    if (!user || !ok) throw invalidCredentials();

    // Phase 1 users belong to one org; pick the oldest membership deterministically.
    const [membership] = await this.db
      .select({ orgId: memberships.orgId })
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .orderBy(asc(memberships.createdAt))
      .limit(1);
    if (!membership) throw invalidCredentials();

    const token = await this.sessions.create(user.id, membership.orgId);
    await this.audit.record({ orgId: membership.orgId, actor: user.email, action: "user.login", target: user.id, metadata: { ip } });
    return { token, me: await this.me(user.id, membership.orgId) };
  }

  async logout(user: UserPrincipal): Promise<void> {
    await this.sessions.revoke(user.sessionId);
    await this.audit.record({ orgId: user.orgId, actor: user.email, action: "user.logout", target: user.userId });
  }

  async me(userId: string, orgId: string, executor: Executor = this.db): Promise<MeResponse> {
    const [row] = await executor
      .select({ user: users, org: orgs, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(orgs, eq(orgs.id, memberships.orgId))
      .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
      .limit(1);
    if (!row) throw notFound("Your account");
    return {
      user: {
        id: row.user.id,
        name: row.user.name,
        email: row.user.email,
        emailVerified: row.user.emailVerifiedAt !== null,
        createdAt: row.user.createdAt.toISOString(),
      },
      org: { id: row.org.id, name: row.org.name, plan: row.org.plan, createdAt: row.org.createdAt.toISOString() },
      role: row.role,
    };
  }

  async updateProfile(user: UserPrincipal, name: string): Promise<MeResponse> {
    await this.db.update(users).set({ name }).where(eq(users.id, user.userId));
    await this.audit.record({ orgId: user.orgId, actor: user.email, action: "user.updated", target: user.userId, metadata: { name } });
    return this.me(user.userId, user.orgId);
  }

  /** Never reveals whether the email exists: the caller always answers 202. */
  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) return;
    const token = newToken();
    await this.db.insert(passwordResets).values({ tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TTL_MS) });
    const url = this.mailer.link("/reset-password", { token });
    // Outside production the link is also logged, so local development never needs a mailbox.
    if (this.config.env !== "production") this.logger.log(`Password reset for ${email}: ${url}`);
    this.mailer.sendLater(email, passwordReset({ url }));
  }

  /* ─── Email verification ─────────────────────────── */

  async verifyEmail(token: string): Promise<void> {
    const now = new Date();
    const [verification] = await this.db
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.tokenHash, hashToken(token)), isNull(emailVerifications.usedAt), gt(emailVerifications.expiresAt, now)))
      .limit(1);
    if (!verification) throw validationFailed({ token: "This verification link is invalid or has expired. Request a new one." });

    await this.db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, verification.userId)).for("update");
      await tx
        .update(emailVerifications)
        .set({ usedAt: now })
        .where(and(eq(emailVerifications.userId, verification.userId), isNull(emailVerifications.usedAt)));
      if (!user || user.emailVerifiedAt) return;
      await tx.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, user.id));
      await this.auditAllOrgs(tx, user.id, { actor: user.email, action: "user.email_verified", target: user.id, metadata: { email: user.email } });
    });
  }

  /** No-op for verified users, so the endpoint can't be used to probe state. */
  async resendVerification(principal: UserPrincipal): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, principal.userId)).limit(1);
    if (!user || user.emailVerifiedAt) return;
    const token = await this.issueVerification(user.id);
    this.sendVerification(user, token);
  }

  private async issueVerification(userId: string, executor: Executor = this.db): Promise<string> {
    const token = newToken();
    await executor.insert(emailVerifications).values({ tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + VERIFY_TTL_MS) });
    return token;
  }

  private sendVerification(user: { name: string; email: string }, token: string): void {
    const url = this.mailer.link("/verify-email", { token });
    if (this.config.env !== "production") this.logger.log(`Email verification for ${user.email}: ${url}`);
    this.mailer.sendLater(user.email, verifyEmail({ name: user.name, url }));
  }

  /* ─── Orgs ───────────────────────────────────────── */

  async memberships(userId: string): Promise<MembershipDto[]> {
    const rows = await this.db
      .select({ orgId: orgs.id, orgName: orgs.name, plan: orgs.plan, role: memberships.role })
      .from(memberships)
      .innerJoin(orgs, eq(orgs.id, memberships.orgId))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(memberships.createdAt));
    return rows;
  }

  async switchOrg(principal: UserPrincipal, orgId: string): Promise<MeResponse> {
    const [membership] = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, principal.userId), eq(memberships.orgId, orgId)))
      .limit(1);
    if (!membership) throw forbidden("You're not a member of that organization.");
    if (orgId === principal.orgId) return this.me(principal.userId, orgId);

    return this.db.transaction(async (tx) => {
      await this.sessions.moveToOrg(principal.sessionId, orgId, tx);
      await this.audit.record(
        { orgId, actor: principal.email, action: "user.switched_org", target: principal.userId, metadata: { from: principal.orgId } },
        tx,
      );
      return this.me(principal.userId, orgId, tx);
    });
  }

  async notificationPrefs(userId: string): Promise<{ alertEmails: boolean }> {
    const [row] = await this.db.select({ alertEmails: users.alertEmails }).from(users).where(eq(users.id, userId)).limit(1);
    return { alertEmails: row?.alertEmails ?? true };
  }

  async updateNotificationPrefs(principal: UserPrincipal, alertEmails: boolean): Promise<{ alertEmails: boolean }> {
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ alertEmails }).where(eq(users.id, principal.userId));
      await this.audit.record(
        { orgId: principal.orgId, actor: principal.email, action: "user.notifications_updated", target: principal.userId, metadata: { alertEmails } },
        tx,
      );
    });
    return { alertEmails };
  }

  private async auditAllOrgs(
    tx: Executor,
    userId: string,
    entry: { actor: string; action: string; target: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    const orgIds = await tx.select({ orgId: memberships.orgId }).from(memberships).where(eq(memberships.userId, userId));
    for (const { orgId } of orgIds) await this.audit.record({ orgId, ...entry }, tx);
  }

  /* ─── Password reset ─────────────────────────────── */

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const now = new Date();
    const [reset] = await this.db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.tokenHash, hashToken(input.token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)))
      .limit(1);
    if (!reset) throw validationFailed({ token: "This reset link is invalid or has expired. Request a new one." });

    const passwordHash = await this.passwords.hash(input.password);
    await this.db.transaction(async (tx) => {
      const [user] = await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId)).returning();
      // Burn every outstanding link, not just this one.
      await tx
        .update(passwordResets)
        .set({ usedAt: now })
        .where(and(eq(passwordResets.userId, reset.userId), isNull(passwordResets.usedAt)));
      await this.sessions.revokeAllForUser(reset.userId, tx);
      await this.auditAllOrgs(tx, reset.userId, { actor: user!.email, action: "password.reset", target: user!.id });
    });
  }
}
