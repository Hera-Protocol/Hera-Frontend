import { Inject, Injectable } from "@nestjs/common";
import { type Paginated, type ScreeningResponse, type ScreeningSummaryDto, type SubjectInput, subjectKey } from "@hera/core";
import { and, count, desc, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { actorOf, type Principal, userIdOf } from "../auth/principal";
import { notFound } from "../common/api-error";
import { parseSubjectOrThrow } from "../common/subject";
import { DATABASE, type Database } from "../db/database";
import { screenings } from "../db/schema";
import { WebhooksService } from "../webhooks/webhooks.service";
import { ScreeningEngine } from "./screening.engine";
import { toScreeningResponse, toScreeningSummary } from "./screening.mapper";

@Injectable()
export class ScreeningsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly engine: ScreeningEngine,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  async screen(principal: Principal, input: SubjectInput): Promise<ScreeningResponse> {
    const subject = parseSubjectOrThrow(input, "address");
    const result = await this.engine.screen(subject);

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(screenings)
        .values({
          orgId: principal.orgId,
          subjectKey: subjectKey(subject),
          chain: subject.chain,
          display: result.display,
          subject,
          score: result.score,
          band: result.band,
          decision: result.decision,
          result,
          createdBy: userIdOf(principal),
          apiKeyId: principal.kind === "api_key" ? principal.keyId : null,
        })
        .returning();
      await this.audit.record(
        {
          orgId: principal.orgId,
          actor: actorOf(principal),
          action: "screening.created",
          target: row!.id,
          metadata: { subject: result.display, chain: subject.chain, score: result.score, decision: result.decision },
        },
        tx,
      );
      await this.webhooks.emit(tx, principal.orgId, "screening.completed", toScreeningSummary(row!));
      return toScreeningResponse(row!);
    });
  }

  async list(orgId: string, limit: number): Promise<Paginated<ScreeningSummaryDto>> {
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(screenings)
        .where(eq(screenings.orgId, orgId))
        .orderBy(desc(screenings.createdAt))
        .limit(limit),
      this.db.select({ value: count() }).from(screenings).where(eq(screenings.orgId, orgId)),
    ]);
    return { items: rows.map(toScreeningSummary), total: total?.value ?? 0 };
  }

  async get(orgId: string, id: string): Promise<ScreeningResponse> {
    const [row] = await this.db
      .select()
      .from(screenings)
      .where(and(eq(screenings.id, id), eq(screenings.orgId, orgId)))
      .limit(1);
    if (!row) throw notFound("That screening");
    return toScreeningResponse(row);
  }
}
