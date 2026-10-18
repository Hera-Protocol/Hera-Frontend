import { Inject, Injectable } from "@nestjs/common";
import type { OrgDetailResponse } from "@hera/core";
import { asc, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { actorOf, type UserPrincipal } from "../auth/principal";
import { notFound } from "../common/api-error";
import { DATABASE, type Database } from "../db/database";
import { memberships, orgs, users } from "../db/schema";

@Injectable()
export class OrgService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async get(orgId: string): Promise<OrgDetailResponse> {
    const [org] = await this.db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!org) throw notFound("Your organization");
    const members = await this.db
      .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role, joinedAt: memberships.createdAt })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, orgId))
      .orderBy(asc(memberships.createdAt));
    return {
      id: org.id,
      name: org.name,
      plan: org.plan,
      createdAt: org.createdAt.toISOString(),
      members: members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() })),
    };
  }

  async update(user: UserPrincipal, name: string): Promise<OrgDetailResponse> {
    await this.db.transaction(async (tx) => {
      const [before] = await tx.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, user.orgId)).for("update");
      await tx.update(orgs).set({ name }).where(eq(orgs.id, user.orgId));
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "org.updated", target: user.orgId, metadata: { from: before?.name, to: name } },
        tx,
      );
    });
    return this.get(user.orgId);
  }
}
