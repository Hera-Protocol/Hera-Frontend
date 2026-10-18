/** Builds the org-wide compliance audit snapshot: counts only, never IVMS101 personal data. */
import { getChain, getJurisdiction, type RiskBand, type TravelRuleCheck, type TravelRuleStatus } from "@hera/core";
import { and, asc, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { ALERT_MIN_POINTS } from "../alerts/alerts.service";
import type { AuditService } from "../audit/audit.service";
import type { Database } from "../db/database";
import { alerts, auditEvents, screenings, travelRuleEvents, travelRuleTransfers, wallets } from "../db/schema";
import { type AuditSnapshot, methodology, type SnapshotHeader } from "./snapshot";

const BANDS: RiskBand[] = ["low", "medium", "high", "severe"];
const DAY_MS = 24 * 60 * 60 * 1000;

const ACCESS_ACTIONS: { label: string; actions: string[] }[] = [
  { label: "Sign-ins", actions: ["user.login"] },
  { label: "Invites sent", actions: ["invite.created", "invite.resent"] },
  { label: "Invites accepted", actions: ["invite.accepted"] },
  { label: "Members removed or left", actions: ["member.removed", "member.left"] },
  { label: "Role changes", actions: ["member.role_changed"] },
  { label: "API keys created", actions: ["api_key.created"] },
  { label: "API keys revoked", actions: ["api_key.revoked"] },
  { label: "Webhook endpoint changes", actions: ["webhook.created", "webhook.updated", "webhook.deleted", "webhook.secret_rotated", "webhook.disabled"] },
  { label: "Organization settings changes", actions: ["org.updated"] },
];

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function humanDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function periodLabel(from: string, to: string, code: string): string {
  const range = `${humanDate(from)} – ${humanDate(to)}`;
  const quarter = /^(\d{4})Q(\d)$/.exec(code);
  return quarter ? `Q${quarter[2]} ${quarter[1]} (${range})` : range;
}

export async function buildAuditSnapshot(
  db: Database,
  audit: AuditService,
  header: Omit<SnapshotHeader, "type">,
  period: { from: string; to: string },
): Promise<AuditSnapshot> {
  const orgId = header.org.id;
  const start = new Date(`${period.from}T00:00:00.000Z`);
  const end = new Date(new Date(`${period.to}T00:00:00.000Z`).getTime() + DAY_MS); // exclusive
  const inPeriod = (column: Parameters<typeof gte>[0]) => and(gte(column, start), lt(column, end));

  /* Screenings */
  const screeningRows = await db
    .select({ chain: screenings.chain, band: screenings.band, decision: screenings.decision, n: count() })
    .from(screenings)
    .where(and(eq(screenings.orgId, orgId), inPeriod(screenings.createdAt)))
    .groupBy(screenings.chain, screenings.band, screenings.decision);
  const chainIds = [...new Set(screeningRows.map((r) => r.chain))].sort();
  const chains = chainIds.map((id) => {
    try {
      return { id, name: getChain(id).name };
    } catch {
      return { id, name: id };
    }
  });
  const bandRows = BANDS.map((band) => {
    const counts: Record<string, number> = {};
    for (const r of screeningRows.filter((row) => row.band === band)) counts[r.chain] = (counts[r.chain] ?? 0) + r.n;
    return { band, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  });
  const chainTotals: Record<string, number> = {};
  for (const r of screeningRows) chainTotals[r.chain] = (chainTotals[r.chain] ?? 0) + r.n;
  const screeningTotal = screeningRows.reduce((a, r) => a + r.n, 0);
  const flagged = screeningRows.filter((r) => r.decision !== "allow").reduce((a, r) => a + r.n, 0);
  const blocked = screeningRows.filter((r) => r.decision === "block").reduce((a, r) => a + r.n, 0);

  /* Alerts: status at the end of the period comes from the audit trail of alert.updated events. */
  const alertRows = await db
    .select({ id: alerts.id, severity: alerts.severity, createdAt: alerts.createdAt })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), lt(alerts.createdAt, end)));
  const transitions = await db
    .select({ target: auditEvents.target, metadata: auditEvents.metadata, createdAt: auditEvents.createdAt })
    .from(auditEvents)
    .where(and(eq(auditEvents.orgId, orgId), eq(auditEvents.action, "alert.updated"), lt(auditEvents.createdAt, end)))
    .orderBy(asc(auditEvents.seq));
  const statusAtEnd = new Map<string, string>();
  const firstClose = new Map<string, Date>();
  let closedTruePositive = 0;
  let closedFalsePositive = 0;
  const escalatedIds = new Set<string>();
  for (const t of transitions) {
    if (!t.target) continue;
    const from = String(t.metadata.from ?? "");
    const to = String(t.metadata.to ?? "");
    statusAtEnd.set(t.target, to);
    if (t.createdAt < start || from === to) continue;
    if (to === "closed") {
      if (!firstClose.has(t.target)) firstClose.set(t.target, t.createdAt);
      if (t.metadata.disposition === "true_positive") closedTruePositive++;
      else if (t.metadata.disposition === "false_positive") closedFalsePositive++;
    }
    if (to === "escalated") escalatedIds.add(t.target);
  }
  const opened = alertRows.filter((a) => a.createdAt >= start);
  const bySeverity: Record<string, number> = {};
  for (const a of opened) bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  const openAtEnd = alertRows.filter((a) => (statusAtEnd.get(a.id) ?? "open") !== "closed").length;
  const createdById = new Map(alertRows.map((a) => [a.id, a.createdAt]));
  const decisionHours = [...firstClose.entries()]
    .map(([id, closedAt]) => {
      const createdAt = createdById.get(id);
      return createdAt ? (closedAt.getTime() - createdAt.getTime()) / 3_600_000 : undefined;
    })
    .filter((h): h is number => h !== undefined);
  const medianHours = median(decisionHours);
  const alertsClosed = closedTruePositive + closedFalsePositive;

  /* Travel Rule: status at the end of the period from the transfer's own event history. */
  const transfers = await db
    .select({
      id: travelRuleTransfers.id,
      jurisdiction: travelRuleTransfers.jurisdiction,
      check: travelRuleTransfers.check,
      unhosted: sql<boolean>`${travelRuleTransfers.beneficiaryVasp} is null or ${travelRuleTransfers.beneficiaryVasp} = 'null'::jsonb`,
    })
    .from(travelRuleTransfers)
    .where(and(eq(travelRuleTransfers.orgId, orgId), inPeriod(travelRuleTransfers.createdAt)));
  const trEvents = transfers.length
    ? await db
        .select({ transferId: travelRuleEvents.transferId, status: travelRuleEvents.status })
        .from(travelRuleEvents)
        .where(and(inArray(travelRuleEvents.transferId, transfers.map((t) => t.id)), lt(travelRuleEvents.at, end)))
        .orderBy(asc(travelRuleEvents.at))
    : [];
  const trStatus = new Map<string, TravelRuleStatus>();
  for (const e of trEvents) trStatus.set(e.transferId, e.status);
  const byJurisdiction = new Map<string, { transfers: number; required: number; completed: number; rejected: number; unhosted: number }>();
  for (const t of transfers) {
    const row = byJurisdiction.get(t.jurisdiction) ?? { transfers: 0, required: 0, completed: 0, rejected: 0, unhosted: 0 };
    const status = trStatus.get(t.id) ?? "draft";
    row.transfers++;
    if ((t.check as TravelRuleCheck).required) row.required++;
    if (status === "accepted" || status === "settled") row.completed++;
    if (status === "rejected") row.rejected++;
    if (t.unhosted) row.unhosted++;
    byJurisdiction.set(t.jurisdiction, row);
  }
  const travelRows = [...byJurisdiction.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, row]) => ({ jurisdiction: code, name: getJurisdiction(code).name, ...row, completionPct: row.transfers ? pct(row.completed, row.transfers) : null }));
  const travelTotal = transfers.length;
  const travelRequired = travelRows.reduce((a, r) => a + r.required, 0);
  const travelCompleted = travelRows.reduce((a, r) => a + r.completed, 0);

  /* Wallets, audit volume, access changes */
  const [[watched], [eventsInPeriod], accessRows, verification] = await Promise.all([
    db.select({ n: count() }).from(wallets).where(and(eq(wallets.orgId, orgId), lt(wallets.createdAt, end))),
    db.select({ n: count() }).from(auditEvents).where(and(eq(auditEvents.orgId, orgId), inPeriod(auditEvents.createdAt))),
    db
      .select({ action: auditEvents.action, n: count() })
      .from(auditEvents)
      .where(and(eq(auditEvents.orgId, orgId), inPeriod(auditEvents.createdAt), inArray(auditEvents.action, ACCESS_ACTIONS.flatMap((a) => a.actions))))
      .groupBy(auditEvents.action),
    audit.verify(orgId),
  ]);
  const accessCount = new Map(accessRows.map((r) => [r.action, r.n]));
  const access = ACCESS_ACTIONS.map(({ label, actions }) => ({ label, count: actions.reduce((a, action) => a + (accessCount.get(action) ?? 0), 0) }));

  /* Executive summary, computed from the numbers above */
  const range = `${humanDate(period.from)} and ${humanDate(period.to)}`;
  const summary: string[] = [];
  summary.push(
    screeningTotal === 0
      ? `${header.org.name} ran no screenings between ${range}.`
      : `Between ${range}, ${header.org.name} ran ${screeningTotal.toLocaleString("en-US")} screening${screeningTotal === 1 ? "" : "s"} across ${chains.length} chain${chains.length === 1 ? "" : "s"}; ${flagged.toLocaleString("en-US")} (${pct(flagged, screeningTotal)}%) were flagged for review or blocked, including ${blocked.toLocaleString("en-US")} block${blocked === 1 ? "" : "s"}.`,
  );
  summary.push(
    `${opened.length} alert${opened.length === 1 ? " was" : "s were"} opened and ${alertsClosed} closed (${closedTruePositive} true positive, ${closedFalsePositive} false positive)${escalatedIds.size ? `, ${escalatedIds.size} escalated` : ""}; ${openAtEnd} remained open at the end of the period.${medianHours === null ? "" : ` The median time to decision was ${medianHours.toFixed(1)} hours.`}`,
  );
  summary.push(
    travelTotal === 0
      ? "No Travel Rule transfers were recorded in the period."
      : `${travelTotal} Travel Rule transfer${travelTotal === 1 ? " was" : "s were"} recorded, ${travelRequired} above the applicable threshold; ${travelCompleted} (${pct(travelCompleted, travelTotal)}%) completed.`,
  );
  summary.push(
    verification.valid
      ? `The audit log's hash chain verified intact across all ${verification.checked} events.`
      : `The audit log's hash chain failed verification at event #${verification.brokenAt}; ${verification.checked} earlier events verified. This needs investigation.`,
  );

  return {
    ...header,
    type: "audit",
    period,
    summary,
    kpis: {
      screenings: screeningTotal,
      flagged,
      blocked,
      alertsOpened: opened.length,
      alertsClosed,
      travelRuleTransfers: travelTotal,
      watchedWallets: watched?.n ?? 0,
      auditEvents: eventsInPeriod?.n ?? 0,
    },
    screenings: { chains, rows: bandRows, totals: chainTotals, total: screeningTotal },
    alerts: {
      opened: opened.length,
      closedTruePositive,
      closedFalsePositive,
      escalated: escalatedIds.size,
      openAtEnd,
      medianHoursToDecision: medianHours === null ? null : Math.round(medianHours * 10) / 10,
      bySeverity,
    },
    travelRule: { rows: travelRows, total: travelTotal },
    access,
    auditLog: { valid: verification.valid, checked: verification.checked, ...(verification.brokenAt ? { brokenAt: verification.brokenAt } : {}), verifiedAt: new Date().toISOString() },
    methodology: methodology(ALERT_MIN_POINTS),
  };
}
