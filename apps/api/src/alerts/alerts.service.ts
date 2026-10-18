import { Inject, Injectable } from "@nestjs/common";
import type { AlertDto, AlertNoteDto, AlertStatus, Reason, ScreeningResult, UpdateAlertInput } from "@hera/core";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { actorNameOf, actorOf, type Principal, userIdOf } from "../auth/principal";
import { notFound, validationFailed } from "../common/api-error";
import { DATABASE, type Database, type Executor } from "../db/database";
import { type AlertSeverity, alertNotes, alerts, memberships, orgs, users, wallets } from "../db/schema";
import { MailerService } from "../mail/mailer.service";
import { alertNotification } from "../mail/templates";
import { WebhooksService } from "../webhooks/webhooks.service";

/** Reasons at or above this many points open an alert on a watched wallet. */
export const ALERT_MIN_POINTS = 25;
/** Severities that email the org's owners and admins. */
const NOTIFY_SEVERITIES = new Set<AlertDto["severity"]>(["high", "critical"]);

type AlertRow = typeof alerts.$inferSelect;

function severityOf(reason: Reason): AlertSeverity {
  return reason.severity === "info" ? "low" : reason.severity;
}

/** One alert per wallet, reason and piece of evidence, however often the wallet is rescreened. */
export function dedupeKey(walletId: string, reason: Reason): string {
  const evidence = reason.evidence?.txHashes?.[0] ?? reason.evidence?.counterparty ?? "subject";
  return `${walletId}:${reason.code}:${evidence}`;
}

function toDto(row: AlertRow, walletLabel: string | null, notes: AlertNoteDto[]): AlertDto {
  return {
    id: row.id,
    ...(row.walletId ? { walletId: row.walletId } : {}),
    ...(walletLabel ? { walletLabel } : {}),
    chain: row.chain,
    subjectDisplay: row.subjectDisplay,
    reasonCode: row.reasonCode,
    title: row.title,
    detail: row.detail,
    severity: row.severity,
    status: row.status,
    ...(row.disposition ? { disposition: row.disposition } : {}),
    score: row.score,
    ...(row.txHash ? { txHash: row.txHash } : {}),
    notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class AlertsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Open alerts for a wallet's screening result and emit `alert.created` for
   * each, inside the caller's transaction. Returns the new alerts; call
   * `notifyCreated` once the transaction commits.
   */
  async raiseForWallet(executor: Executor, wallet: { id: string; orgId: string }, result: ScreeningResult): Promise<AlertDto[]> {
    const values = result.reasons
      .filter((reason) => reason.points >= ALERT_MIN_POINTS)
      .map((reason) => ({
        orgId: wallet.orgId,
        walletId: wallet.id,
        chain: result.subject.chain,
        subjectDisplay: result.display,
        reasonCode: reason.code,
        title: reason.title,
        detail: reason.detail,
        severity: severityOf(reason),
        score: result.score,
        txHash: reason.evidence?.txHashes?.[0] ?? null,
        dedupeKey: dedupeKey(wallet.id, reason),
      }));
    if (values.length === 0) return [];
    const inserted = await executor
      .insert(alerts)
      .values(values)
      .onConflictDoNothing({ target: [alerts.orgId, alerts.dedupeKey] })
      .returning({ id: alerts.id });
    if (inserted.length === 0) return [];

    const rows = await executor
      .select({ alert: alerts, walletLabel: wallets.label })
      .from(alerts)
      .leftJoin(wallets, eq(wallets.id, alerts.walletId))
      .where(inArray(alerts.id, inserted.map((r) => r.id)))
      .orderBy(asc(alerts.createdAt));
    const created = await this.withNotes(rows, executor);
    for (const alert of created) await this.webhooks.emit(executor, wallet.orgId, "alert.created", alert);
    return created;
  }

  /** Email owners and admins (who haven't opted out) about new high and critical alerts. Never throws. */
  async notifyCreated(orgId: string, created: AlertDto[]): Promise<void> {
    const serious = created.filter((alert) => NOTIFY_SEVERITIES.has(alert.severity));
    if (serious.length === 0) return;
    try {
      const [org] = await this.db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
      const recipients = await this.db
        .select({ email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.orgId, orgId), inArray(memberships.role, ["owner", "admin"]), eq(users.alertEmails, true)));
      const email = alertNotification({ orgName: org?.name ?? "your organization", alerts: serious, url: this.mailer.link("/app/alerts") });
      for (const { email: to } of recipients) this.mailer.sendLater(to, email);
    } catch {
      // Notification is best effort; the alert itself is already committed.
    }
  }

  async list(orgId: string, options: { status?: AlertStatus; limit?: number } = {}): Promise<AlertDto[]> {
    const conditions: SQL[] = [eq(alerts.orgId, orgId)];
    if (options.status) conditions.push(eq(alerts.status, options.status));
    const query = this.db
      .select({ alert: alerts, walletLabel: wallets.label })
      .from(alerts)
      .leftJoin(wallets, eq(wallets.id, alerts.walletId))
      .where(and(...conditions))
      .orderBy(desc(alerts.createdAt));
    const rows = options.limit ? await query.limit(options.limit) : await query;
    return this.withNotes(rows);
  }

  async get(orgId: string, id: string, executor: Executor = this.db): Promise<AlertDto> {
    const rows = await executor
      .select({ alert: alerts, walletLabel: wallets.label })
      .from(alerts)
      .leftJoin(wallets, eq(wallets.id, alerts.walletId))
      .where(and(eq(alerts.id, id), eq(alerts.orgId, orgId)))
      .limit(1);
    if (rows.length === 0) throw notFound("That alert");
    const [dto] = await this.withNotes(rows, executor);
    return dto!;
  }

  async update(user: Principal, id: string, input: UpdateAlertInput): Promise<AlertDto> {
    if (!input.status && !input.disposition && !input.note) {
      throw validationFailed({ _: "Change the status or disposition, or add a note." }, "Nothing to update.");
    }
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(alerts)
        .where(and(eq(alerts.id, id), eq(alerts.orgId, user.orgId)))
        .for("update");
      if (!current) throw notFound("That alert");

      await tx
        .update(alerts)
        .set({
          ...(input.status ? { status: input.status } : {}),
          ...(input.disposition ? { disposition: input.disposition } : {}),
          updatedAt: new Date(),
        })
        .where(eq(alerts.id, id));
      if (input.note) {
        await tx.insert(alertNotes).values({ orgId: user.orgId, alertId: id, authorId: userIdOf(user), authorName: actorNameOf(user), body: input.note });
      }
      const updated = await this.get(user.orgId, id, tx);
      await this.webhooks.emit(tx, user.orgId, "alert.updated", updated);
      await this.audit.record(
        {
          orgId: user.orgId,
          actor: actorOf(user),
          action: "alert.updated",
          target: id,
          metadata: {
            from: current.status,
            to: input.status ?? current.status,
            disposition: input.disposition,
            noted: Boolean(input.note),
          },
        },
        tx,
      );
      return updated;
    });
  }

  private async withNotes(rows: { alert: AlertRow; walletLabel: string | null }[], executor: Executor = this.db): Promise<AlertDto[]> {
    if (rows.length === 0) return [];
    const notes = await executor
      .select({ id: alertNotes.id, alertId: alertNotes.alertId, body: alertNotes.body, createdAt: alertNotes.createdAt, author: users.name, authorName: alertNotes.authorName })
      .from(alertNotes)
      .leftJoin(users, eq(users.id, alertNotes.authorId))
      .where(inArray(alertNotes.alertId, rows.map((r) => r.alert.id)))
      .orderBy(asc(alertNotes.createdAt));

    const byAlert = new Map<string, AlertNoteDto[]>();
    for (const note of notes) {
      const list = byAlert.get(note.alertId) ?? [];
      list.push({ id: note.id, author: note.author ?? note.authorName ?? "Former member", body: note.body, createdAt: note.createdAt.toISOString() });
      byAlert.set(note.alertId, list);
    }
    return rows.map((r) => toDto(r.alert, r.walletLabel, byAlert.get(r.alert.id) ?? []));
  }
}
