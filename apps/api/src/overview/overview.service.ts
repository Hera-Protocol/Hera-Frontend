import { Inject, Injectable } from "@nestjs/common";
import type { OverviewResponse, RiskBand } from "@hera/core";
import { and, count, desc, eq, gte, ne, notInArray, sql } from "drizzle-orm";
import { AlertsService } from "../alerts/alerts.service";
import { DATABASE, type Database } from "../db/database";
import { alerts, screenings, travelRuleTransfers, wallets } from "../db/schema";
import { toScreeningSummary } from "../screening/screening.mapper";

const DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT = 5;

/** UTC calendar days, oldest first, ending today. */
function lastDays(now: Date, days: number): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

@Injectable()
export class OverviewService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly alerts: AlertsService,
  ) {}

  async get(orgId: string, now = new Date()): Promise<OverviewResponse> {
    const days = lastDays(now, DAYS);
    const since = new Date(`${days[0]}T00:00:00.000Z`);
    const day = sql<string>`to_char(${screenings.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
    const byOrg = eq(screenings.orgId, orgId);

    const [[totals], bands, daily, [openAlerts], [watched], [travelOpen], recent, recentAlerts] = await Promise.all([
      this.db
        .select({
          total: count(),
          last24h: sql<number>`count(*) filter (where ${screenings.createdAt} >= ${new Date(now.getTime() - DAY_MS).toISOString()}::timestamptz)`.mapWith(Number),
        })
        .from(screenings)
        .where(byOrg),
      this.db.select({ band: screenings.band, n: count() }).from(screenings).where(byOrg).groupBy(screenings.band),
      this.db
        .select({
          day,
          screenings: count(),
          flagged: sql<number>`count(*) filter (where ${screenings.decision} <> 'allow')`.mapWith(Number),
        })
        .from(screenings)
        .where(and(byOrg, gte(screenings.createdAt, since)))
        .groupBy(day),
      this.db.select({ n: count() }).from(alerts).where(and(eq(alerts.orgId, orgId), ne(alerts.status, "closed"))),
      this.db.select({ n: count() }).from(wallets).where(eq(wallets.orgId, orgId)),
      this.db
        .select({ n: count() })
        .from(travelRuleTransfers)
        .where(and(eq(travelRuleTransfers.orgId, orgId), notInArray(travelRuleTransfers.status, ["settled", "rejected"]))),
      this.db.select().from(screenings).where(byOrg).orderBy(desc(screenings.createdAt)).limit(RECENT),
      this.alerts.list(orgId, { limit: RECENT }),
    ]);

    const bandMix: Record<RiskBand, number> = { low: 0, medium: 0, high: 0, severe: 0 };
    for (const { band, n } of bands) bandMix[band] = n;
    const dailyByDay = new Map(daily.map((d) => [d.day, d]));

    return {
      screenings24h: totals?.last24h ?? 0,
      screeningsTotal: totals?.total ?? 0,
      openAlerts: openAlerts?.n ?? 0,
      watchedWallets: watched?.n ?? 0,
      travelRuleOpen: travelOpen?.n ?? 0,
      bandMix,
      daily: days.map((date) => ({
        date,
        screenings: dailyByDay.get(date)?.screenings ?? 0,
        flagged: dailyByDay.get(date)?.flagged ?? 0,
      })),
      recentScreenings: recent.map(toScreeningSummary),
      recentAlerts,
    };
  }
}
