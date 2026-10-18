import { Inject, Injectable } from "@nestjs/common";
import { type CreateWalletInput, type ScreeningResult, subjectKey, type WalletDto } from "@hera/core";
import { and, desc, eq } from "drizzle-orm";
import { AlertsService } from "../alerts/alerts.service";
import { AuditService } from "../audit/audit.service";
import { actorOf, type Principal, userIdOf } from "../auth/principal";
import { conflict, notFound } from "../common/api-error";
import { toIso } from "../common/query";
import { parseSubjectOrThrow } from "../common/subject";
import { DATABASE, type Database, isUniqueViolation } from "../db/database";
import { wallets } from "../db/schema";
import { ScreeningEngine } from "../screening/screening.engine";
import { WebhooksService } from "../webhooks/webhooks.service";

export type WalletRow = typeof wallets.$inferSelect;

const alreadyWatched = () => conflict("wallet_exists", "You're already watching that wallet.");

function toDto(row: WalletRow): WalletDto {
  return {
    id: row.id,
    chain: row.chain,
    subject: row.subject,
    display: row.display,
    label: row.label,
    ...(row.customerRef ? { customerRef: row.customerRef } : {}),
    ...(row.lastScore !== null ? { lastScore: row.lastScore } : {}),
    ...(row.lastBand ? { lastBand: row.lastBand } : {}),
    ...(row.lastCheckedAt ? { lastCheckedAt: toIso(row.lastCheckedAt) } : {}),
    ...(row.lastActivityAt ? { lastActivityAt: toIso(row.lastActivityAt) } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

function newestActivity(result: ScreeningResult): Date | null {
  let newest: string | undefined;
  for (const transfer of result.transfers) if (!newest || transfer.timestamp > newest) newest = transfer.timestamp;
  return newest ? new Date(newest) : null;
}

/** Transfers newer than the last activity we knew about. */
function transfersSince(result: ScreeningResult, since: Date | null): number {
  if (!since) return result.transfers.length;
  return result.transfers.filter((transfer) => new Date(transfer.timestamp) > since).length;
}

function screeningColumns(result: ScreeningResult) {
  return { lastScore: result.score, lastBand: result.band, lastCheckedAt: new Date(), lastActivityAt: newestActivity(result) };
}

@Injectable()
export class WalletsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly engine: ScreeningEngine,
    private readonly alerts: AlertsService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(orgId: string): Promise<WalletDto[]> {
    const rows = await this.db.select().from(wallets).where(eq(wallets.orgId, orgId)).orderBy(desc(wallets.createdAt));
    return rows.map(toDto);
  }

  async create(user: Principal, input: CreateWalletInput): Promise<WalletDto> {
    const subject = parseSubjectOrThrow(input, "address");
    const key = subjectKey(subject);
    const [existing] = await this.db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(eq(wallets.orgId, user.orgId), eq(wallets.subjectKey, key)))
      .limit(1);
    if (existing) throw alreadyWatched();

    // Screen before inserting, so a chain outage doesn't leave a wallet that was never checked.
    const result = await this.engine.screen(subject);
    try {
      const { dto, raised } = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(wallets)
          .values({
            orgId: user.orgId,
            subjectKey: key,
            chain: subject.chain,
            subject,
            display: result.display,
            label: input.label,
            customerRef: input.customerRef || null,
            createdBy: userIdOf(user),
            ...screeningColumns(result),
          })
          .returning();
        const raised = await this.alerts.raiseForWallet(tx, row!, result);
        await this.audit.record(
          {
            orgId: user.orgId,
            actor: actorOf(user),
            action: "wallet.created",
            target: row!.id,
            metadata: { subject: result.display, label: input.label, score: result.score, alertsRaised: raised.length },
          },
          tx,
        );
        return { dto: toDto(row!), raised };
      });
      await this.alerts.notifyCreated(user.orgId, raised);
      return dto;
    } catch (error) {
      if (isUniqueViolation(error)) throw alreadyWatched();
      throw error;
    }
  }

  async remove(user: Principal, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .delete(wallets)
        .where(and(eq(wallets.id, id), eq(wallets.orgId, user.orgId)))
        .returning();
      if (!row) throw notFound("That wallet");
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "wallet.deleted", target: row.id, metadata: { subject: row.display, label: row.label } },
        tx,
      );
    });
  }

  async refresh(orgId: string, id: string): Promise<WalletDto> {
    const [row] = await this.db
      .select()
      .from(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.orgId, orgId)))
      .limit(1);
    if (!row) throw notFound("That wallet");
    return toDto(await this.rescreen(row, "interactive"));
  }

  /**
   * Fresh screen, updated scores, alerts for anything new, and `wallet.activity`
   * when the chain shows newer activity than we'd seen. Shared by refresh and the monitor.
   */
  async rescreen(wallet: WalletRow, budget: "interactive" | "background" = "background"): Promise<WalletRow> {
    const result = await this.engine.screen(wallet.subject, { fresh: true, budget });
    const { updated, raised } = await this.db.transaction(async (tx) => {
      const [updated] = await tx.update(wallets).set(screeningColumns(result)).where(eq(wallets.id, wallet.id)).returning();
      const raised = await this.alerts.raiseForWallet(tx, wallet, result);
      const activityAt = updated?.lastActivityAt ?? null;
      if (updated && activityAt && (!wallet.lastActivityAt || activityAt > wallet.lastActivityAt)) {
        await this.webhooks.emit(tx, wallet.orgId, "wallet.activity", { wallet: toDto(updated), newTransfers: transfersSince(result, wallet.lastActivityAt) });
      }
      return { updated: updated ?? wallet, raised };
    });
    await this.alerts.notifyCreated(wallet.orgId, raised);
    return updated;
  }
}
