import { Inject, Injectable } from "@nestjs/common";
import type { MemberDto, Role } from "@hera/core";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { actorOf, type UserPrincipal } from "../auth/principal";
import { roleAtLeast } from "../auth/roles";
import { SessionsService } from "../auth/sessions.service";
import { conflict, forbidden, notFound } from "../common/api-error";
import { DATABASE, type Database, type Transaction } from "../db/database";
import { memberships, users } from "../db/schema";

const lastOwner = () => conflict("last_owner", "Every organization needs an owner. Make someone else an owner first.");

@Injectable()
export class MembersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly sessions: SessionsService,
  ) {}

  /** Owners can set any role; admins can't touch owners or create them; the last owner stays an owner. */
  async updateRole(actor: UserPrincipal, userId: string, role: Role): Promise<MemberDto> {
    return this.db.transaction(async (tx) => {
      const target = await this.lockMember(tx, actor.orgId, userId);
      if (target.role === role) return target;
      if (actor.role !== "owner") {
        if (target.role === "owner") throw forbidden("Only owners can change an owner's role.");
        if (role === "owner") throw forbidden("Only owners can make someone an owner.");
      }
      if (target.role === "owner" && (await this.ownerCount(tx, actor.orgId)) <= 1) throw lastOwner();

      await tx.update(memberships).set({ role }).where(and(eq(memberships.orgId, actor.orgId), eq(memberships.userId, userId)));
      await this.audit.record(
        { orgId: actor.orgId, actor: actorOf(actor), action: "member.role_changed", target: userId, metadata: { email: target.email, from: target.role, to: role } },
        tx,
      );
      return { ...target, role };
    });
  }

  /** Admins remove others (owners need an owner); anyone can leave, except the last owner. */
  async remove(actor: UserPrincipal, userId: string): Promise<void> {
    const self = userId === actor.userId;
    if (!self && !roleAtLeast(actor.role, "admin")) throw forbidden();

    await this.db.transaction(async (tx) => {
      const target = await this.lockMember(tx, actor.orgId, userId);
      if (!self && target.role === "owner" && actor.role !== "owner") throw forbidden("Only owners can remove an owner.");
      if (target.role === "owner" && (await this.ownerCount(tx, actor.orgId)) <= 1) throw lastOwner();

      await tx.delete(memberships).where(and(eq(memberships.orgId, actor.orgId), eq(memberships.userId, userId)));
      await this.sessions.revokeForOrg(userId, actor.orgId, tx);
      await this.audit.record(
        {
          orgId: actor.orgId,
          actor: actorOf(actor),
          action: self ? "member.left" : "member.removed",
          target: userId,
          metadata: { email: target.email, role: target.role },
        },
        tx,
      );
    });
  }

  private async lockMember(tx: Transaction, orgId: string, userId: string): Promise<MemberDto> {
    const [row] = await tx
      .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role, joinedAt: memberships.createdAt })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
      .for("update", { of: memberships });
    if (!row) throw notFound("That member");
    return { ...row, joinedAt: row.joinedAt.toISOString() };
  }

  /** Locks the owner rows, so two concurrent demotions can't both pass the check. */
  private async ownerCount(tx: Transaction, orgId: string): Promise<number> {
    const owners = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")))
      .for("update");
    return owners.length;
  }
}
