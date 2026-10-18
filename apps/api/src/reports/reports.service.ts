import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { type CreateReportInput, ENGINE_VERSION, type ReportDto, type ReportType, type ReportVerifyResponse } from "@hera/core";
import { and, desc, eq, or } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { actorOf, type Principal, userIdOf } from "../auth/principal";
import { conflict, forbidden, notFound } from "../common/api-error";
import { toIso } from "../common/query";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { DATABASE, type Database, type Executor, isUniqueViolation } from "../db/database";
import { orgs, reports, screenings, users } from "../db/schema";
import { MailerService } from "../mail/mailer.service";
import { reportReady } from "../mail/templates";
import { TravelRuleService } from "../travel-rule/travel-rule.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { buildAuditSnapshot, periodLabel } from "./audit-snapshot";
import { monthCode, newReportReference, periodCode } from "./reference";
import { buildEvidenceSnapshot, buildTravelRuleSnapshot, freeze, shortForm, type ReportSnapshot, sha256Hex, SNAPSHOT_SCHEMA, type SnapshotHeader } from "./snapshot";
import { REPORT_STORAGE, type ReportStorage } from "./storage";
import { renderReportPdf } from "./templates/render";

type ReportRow = typeof reports.$inferSelect;

const REFERENCE_ATTEMPTS = 5;
const LIST_LIMIT = 100;

export function toReportDto(row: ReportRow): ReportDto {
  return {
    id: row.id,
    reference: row.reference,
    type: row.type,
    title: row.title,
    status: row.status,
    ...(row.jsonSha256 ? { jsonSha256: row.jsonSha256 } : {}),
    ...(row.pdfSha256 ? { pdfSha256: row.pdfSha256 } : {}),
    requestedBy: row.requestedByName,
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.createdAt.toISOString(),
    ...(row.readyAt ? { readyAt: toIso(row.readyAt) } : {}),
  };
}

function requesterName(principal: Principal): string {
  return principal.kind === "user" ? `${principal.name} (${principal.email})` : `API key "${principal.name}" (${principal.prefix})`;
}

export interface CreatedReport {
  report: ReportDto;
  /** 201 when rendered synchronously, 202 when queued. */
  status: 201 | 202;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger("Reports");

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REPORT_STORAGE) private readonly storage: ReportStorage,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
    private readonly travelRule: TravelRuleService,
    private readonly mailer: MailerService,
  ) {}

  async create(principal: Principal, input: CreateReportInput): Promise<CreatedReport> {
    if (principal.kind === "api_key") {
      if (input.type === "audit") throw forbidden("Audit reports cover the whole org and need a dashboard session.");
      if (input.type === "travel_rule" && !principal.scopes.includes("travel_rule")) {
        throw forbidden('Travel Rule records contain personal data: this API key also needs the "travel_rule" scope.');
      }
    }
    if (input.type === "audit") return { status: 202, report: await this.enqueueAudit(principal, input) };
    return { status: 201, report: await this.renderNow(principal, input) };
  }

  async list(orgId: string): Promise<ReportDto[]> {
    const rows = await this.db.select().from(reports).where(eq(reports.orgId, orgId)).orderBy(desc(reports.createdAt)).limit(LIST_LIMIT);
    return rows.map(toReportDto);
  }

  async get(orgId: string, id: string): Promise<ReportDto> {
    return toReportDto(await this.row(orgId, id));
  }

  /** The stored PDF or canonical JSON bytes, exactly as hashed. */
  async artifact(principal: Principal, id: string, kind: "pdf" | "json"): Promise<{ reference: string; bytes: Buffer }> {
    const row = await this.row(principal.orgId, id);
    if (principal.kind === "api_key" && row.type === "travel_rule" && !principal.scopes.includes("travel_rule")) {
      throw forbidden('Travel Rule records contain personal data: this API key also needs the "travel_rule" scope.');
    }
    if (row.status !== "ready" || !row.storageKey) throw conflict("report_not_ready", `This report is ${row.status}. Try again when it's ready.`);
    return { reference: row.reference, bytes: await this.storage.get(row.storageKey, kind) };
  }

  /** Public. Says whether a hash belongs to a genuine report, and whose, without revealing contents. */
  async verify(sha256: string): Promise<ReportVerifyResponse> {
    const hash = sha256.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hash)) return { valid: false };
    const [found] = await this.db
      .select({ report: reports, orgName: orgs.name })
      .from(reports)
      .innerJoin(orgs, eq(orgs.id, reports.orgId))
      .where(and(eq(reports.status, "ready"), or(eq(reports.pdfSha256, hash), eq(reports.jsonSha256, hash))))
      .limit(1);
    if (!found) return { valid: false };
    return {
      valid: true,
      reference: found.report.reference,
      type: found.report.type,
      orgName: found.orgName,
      createdAt: found.report.createdAt.toISOString(),
      matched: found.report.pdfSha256 === hash ? "pdf" : "json",
    };
  }

  /* ─── Synchronous: evidence and Travel Rule records ─── */

  private async renderNow(principal: Principal, input: Exclude<CreateReportInput, { type: "audit" }>): Promise<ReportDto> {
    const org = await this.org(principal.orgId);
    const generatedAt = new Date();

    // Load the subject first so a bad id is a clean 404 before anything is written.
    const source =
      input.type === "screening_evidence"
        ? { kind: "screening" as const, screening: await this.screening(principal.orgId, input.screeningId) }
        : { kind: "transfer" as const, transfer: await this.travelRule.get(principal.orgId, input.transferId) };
    const title =
      source.kind === "screening" ? `Screening evidence: ${shortForm(source.screening.display)}` : `Travel Rule record ${source.transfer.reference}`;

    for (let attempt = 1; ; attempt++) {
      const id = randomUUID();
      const reference = newReportReference(monthCode(generatedAt));
      const header = this.header({ reference, type: input.type, title, org, generatedAt, principal });
      const snapshot =
        source.kind === "screening"
          ? buildEvidenceSnapshot(header, source.screening, this.config.horizonUrl)
          : buildTravelRuleSnapshot(header, source.transfer);
      try {
        return await this.persistReady(principal, { id, reference, title, type: input.type, params: { ...input } }, snapshot);
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= REFERENCE_ATTEMPTS) throw error;
      }
    }
  }

  /** Render, store, then record the row, audit event and `report.ready` in one transaction. */
  private async persistReady(
    principal: Principal,
    meta: { id: string; reference: string; title: string; type: ReportType; params: Record<string, unknown> },
    snapshot: ReportSnapshot,
  ): Promise<ReportDto> {
    const artifacts = await this.renderArtifacts(principal.orgId, meta.id, snapshot);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(reports)
        .values({
          id: meta.id,
          orgId: principal.orgId,
          reference: meta.reference,
          type: meta.type,
          title: meta.title,
          status: "ready",
          params: meta.params,
          snapshot: snapshot as unknown as Record<string, unknown>,
          jsonSha256: artifacts.jsonSha256,
          pdfSha256: artifacts.pdfSha256,
          storageKey: artifacts.storageKey,
          requestedBy: userIdOf(principal),
          requestedByName: requesterName(principal),
          apiKeyId: principal.kind === "api_key" ? principal.keyId : null,
          createdAt: new Date(snapshot.generatedAt),
          readyAt: new Date(),
        })
        .returning();
      return this.markGenerated(tx, row!, actorOf(principal));
    });
  }

  private async renderArtifacts(orgId: string, reportId: string, snapshot: ReportSnapshot) {
    const started = Date.now();
    const frozen = freeze(snapshot);
    const pdf = await renderReportPdf(snapshot, frozen.sha256);
    const storageKey = `${orgId}/${reportId}`;
    await this.storage.put(storageKey, { pdf, json: frozen.json });
    this.logger.log(`Rendered ${snapshot.reference} (${snapshot.type}, ${Math.round(pdf.length / 1024)} KB) in ${Date.now() - started}ms`);
    return { storageKey, jsonSha256: frozen.sha256, pdfSha256: sha256Hex(pdf) };
  }

  private async markGenerated(tx: Executor, row: ReportRow, actor: string): Promise<ReportDto> {
    const dto = toReportDto(row);
    await this.audit.record(
      {
        orgId: row.orgId,
        actor,
        action: "report.generated",
        target: row.id,
        metadata: { reference: row.reference, type: row.type, jsonSha256: row.jsonSha256, pdfSha256: row.pdfSha256 },
      },
      tx,
    );
    await this.webhooks.emit(tx, row.orgId, "report.ready", dto);
    return dto;
  }

  /* ─── Asynchronous: the org-wide audit report ──────── */

  private async enqueueAudit(principal: Principal, input: Extract<CreateReportInput, { type: "audit" }>): Promise<ReportDto> {
    const code = periodCode(input.from, input.to);
    const title = `Compliance audit report: ${periodLabel(input.from, input.to, code)}`;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(reports)
            .values({
              orgId: principal.orgId,
              reference: newReportReference(code),
              type: "audit",
              title,
              status: "queued",
              params: { type: "audit", from: input.from, to: input.to },
              requestedBy: userIdOf(principal),
              requestedByName: requesterName(principal),
            })
            .returning();
          await this.audit.record(
            { orgId: principal.orgId, actor: actorOf(principal), action: "report.requested", target: row!.id, metadata: { reference: row!.reference, type: "audit", from: input.from, to: input.to } },
            tx,
          );
          return toReportDto(row!);
        });
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= REFERENCE_ATTEMPTS) throw error;
      }
    }
  }

  /**
   * Claim one queued report (queued → rendering), so concurrent runners never
   * render the same report twice. Returns its id, or null when the queue is empty.
   */
  async claimQueued(): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [next] = await tx
        .select({ id: reports.id })
        .from(reports)
        .where(eq(reports.status, "queued"))
        .orderBy(reports.createdAt)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!next) return null;
      await tx.update(reports).set({ status: "rendering" }).where(eq(reports.id, next.id));
      return next.id;
    });
  }

  /** Render a claimed audit report: rendering → ready | failed. */
  async renderQueued(id: string): Promise<ReportDto> {
    const [row] = await this.db.select().from(reports).where(eq(reports.id, id)).limit(1);
    if (!row) throw notFound("That report");
    try {
      const org = await this.org(row.orgId);
      const params = row.params as { from: string; to: string };
      const header = {
        schema: SNAPSHOT_SCHEMA,
        reference: row.reference,
        title: row.title,
        org,
        scope: periodLabel(params.from, params.to, periodCode(params.from, params.to)),
        generatedAt: new Date().toISOString(),
        requestedBy: row.requestedByName,
        engineVersion: ENGINE_VERSION,
        verifyUrl: this.verifyUrl(row.reference),
      } satisfies Omit<SnapshotHeader, "type">;
      const snapshot = await buildAuditSnapshot(this.db, this.audit, header, params);
      const artifacts = await this.renderArtifacts(row.orgId, row.id, snapshot);

      const dto = await this.db.transaction(async (tx) => {
        const [ready] = await tx
          .update(reports)
          .set({ status: "ready", snapshot: snapshot as unknown as Record<string, unknown>, ...artifacts, error: null, readyAt: new Date() })
          .where(eq(reports.id, id))
          .returning();
        return this.markGenerated(tx, ready!, "system");
      });
      await this.notifyRequester(row, dto);
      return dto;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Report ${row.reference} failed: ${message}`);
      const [failed] = await this.db
        .update(reports)
        .set({ status: "failed", error: message.slice(0, 500) })
        .where(eq(reports.id, id))
        .returning();
      await this.audit.record({ orgId: row.orgId, actor: "system", action: "report.failed", target: id, metadata: { reference: row.reference, error: message.slice(0, 200) } });
      return toReportDto(failed!);
    }
  }

  private async notifyRequester(row: ReportRow, report: ReportDto): Promise<void> {
    if (!row.requestedBy) return;
    const [user] = await this.db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, row.requestedBy)).limit(1);
    if (!user) return;
    this.mailer.sendLater(user.email, reportReady({ name: user.name, report, url: this.mailer.link(`/app/reports/${report.id}`) }));
  }

  /* ─── Helpers ──────────────────────────────────────── */

  private header(input: { reference: string; type: ReportType; title: string; org: { id: string; name: string }; generatedAt: Date; principal: Principal }) {
    return {
      schema: SNAPSHOT_SCHEMA,
      reference: input.reference,
      title: input.title,
      org: input.org,
      generatedAt: input.generatedAt.toISOString(),
      requestedBy: requesterName(input.principal),
      engineVersion: ENGINE_VERSION,
      verifyUrl: this.verifyUrl(input.reference),
    } satisfies Omit<SnapshotHeader, "type" | "scope">;
  }

  private verifyUrl(reference: string): string {
    return `${this.config.webOrigin}/verify/${reference}`;
  }

  private async org(orgId: string): Promise<{ id: string; name: string }> {
    const [org] = await this.db.select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!org) throw notFound("Your organization");
    return org;
  }

  private async screening(orgId: string, id: string) {
    const [row] = await this.db
      .select({ id: screenings.id, createdAt: screenings.createdAt, result: screenings.result, display: screenings.display })
      .from(screenings)
      .where(and(eq(screenings.id, id), eq(screenings.orgId, orgId)))
      .limit(1);
    if (!row) throw notFound("That screening");
    return row;
  }

  private async row(orgId: string, id: string): Promise<ReportRow> {
    const [row] = await this.db
      .select()
      .from(reports)
      .where(and(eq(reports.id, id), eq(reports.orgId, orgId)))
      .limit(1);
    if (!row) throw notFound("That report");
    return row;
  }
}
