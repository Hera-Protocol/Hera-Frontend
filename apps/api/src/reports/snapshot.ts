/**
 * Report snapshots: plain JSON, frozen at generation time. The PDF is rendered
 * from the snapshot alone, and the snapshot's canonical-JSON SHA-256 is what
 * the footer and the verify endpoint vouch for.
 */
import { createHash } from "node:crypto";
import {
  type ChainId,
  CATEGORY_LABEL,
  CATEGORY_SEVERITY,
  ENGINE_VERSION,
  getChain,
  getJurisdiction,
  JURISDICTIONS,
  type Jurisdiction,
  type LabelCategory,
  type ReasonCode,
  type ReportType,
  type RiskBand,
  SEED_LABELS,
  type ScreeningResult,
  type SubjectRef,
  type TravelRuleTransferDto,
} from "@hera/core";
import { canonicalJson } from "../audit/hash-chain";

export const SNAPSHOT_SCHEMA = "hera.report/v1";

export interface SnapshotHeader {
  schema: typeof SNAPSHOT_SCHEMA;
  reference: string;
  type: ReportType;
  title: string;
  org: { id: string; name: string };
  /** One line under the title: the subject or the period. */
  scope: string;
  generatedAt: string;
  requestedBy: string;
  engineVersion: string;
  verifyUrl: string;
}

/* ─── Screening evidence ─────────────────────────────── */

export interface EvidenceSnapshot extends SnapshotHeader {
  type: "screening_evidence";
  screening: {
    id: string;
    screenedAt: string;
    recordedAt: string;
    chain: ChainId;
    chainName: string;
    display: string;
    subject: SubjectRef;
    identity: { label: string; value: string }[];
    score: number;
    band: RiskBand;
    decision: ScreeningResult["decision"];
    engineVersion: string;
  };
  reasons: {
    code: ReasonCode;
    title: string;
    detail: string;
    points: number;
    severity: string;
    provenance?: { entity: string; category: string; source: string; sourceUrl?: string; confidence: number; addedAt: string };
    txHashes?: string[];
    counterparty?: string;
  }[];
  counterparties: { address: string; muxedId?: string; inbound: number; outbound: number; labels: string[] }[];
  transfers: { timestamp: string; txHash: string; kind: string; direction: "in" | "out" | "self"; counterparty: string; asset: string; amount: string; successful: boolean }[];
  transfersOmitted: number;
  stats: ScreeningResult["stats"];
  /** How much history the score rests on, as reported by the chain adapter. */
  dataWindow?: { pages: Record<string, number>; records: number; truncatedBy?: string; oldest?: string; fullHistory: boolean };
  /** EIP-7702: the contract the EOA delegates its code to. */
  delegatedTo?: string;
  dataSources: string[];
}

/* ─── Travel Rule record ─────────────────────────────── */

export interface TravelRuleSnapshot extends SnapshotHeader {
  type: "travel_rule";
  transfer: TravelRuleTransferDto;
  jurisdiction: Jurisdiction;
}

/* ─── Compliance audit ───────────────────────────────── */

export interface AuditSnapshot extends SnapshotHeader {
  type: "audit";
  period: { from: string; to: string };
  summary: string[];
  kpis: {
    screenings: number;
    flagged: number;
    blocked: number;
    alertsOpened: number;
    alertsClosed: number;
    travelRuleTransfers: number;
    watchedWallets: number;
    auditEvents: number;
  };
  screenings: { chains: { id: string; name: string }[]; rows: { band: RiskBand; counts: Record<string, number>; total: number }[]; totals: Record<string, number>; total: number };
  alerts: {
    opened: number;
    closedTruePositive: number;
    closedFalsePositive: number;
    escalated: number;
    openAtEnd: number;
    medianHoursToDecision: number | null;
    bySeverity: Record<string, number>;
  };
  travelRule: {
    rows: { jurisdiction: string; name: string; transfers: number; required: number; completed: number; rejected: number; unhosted: number; completionPct: number | null }[];
    total: number;
  };
  access: { label: string; count: number }[];
  auditLog: { valid: boolean; checked: number; brokenAt?: number; verifiedAt: string };
  methodology: {
    bands: { band: RiskBand; range: string; decision: string }[];
    reasonCodes: { code: ReasonCode; description: string }[];
    alertThresholdPoints: number;
    categories: { category: string; label: string; severity: number }[];
    labelSources: { source: string; url?: string; labels: number; categories: string[] }[];
    jurisdictions: Jurisdiction[];
  };
}

export type ReportSnapshot = EvidenceSnapshot | TravelRuleSnapshot | AuditSnapshot;

/** Canonical bytes and their hash. These bytes are what GET /reports/:id/json serves. */
export function freeze(snapshot: ReportSnapshot): { json: Buffer; sha256: string } {
  const json = Buffer.from(canonicalJson(snapshot), "utf8");
  return { json, sha256: sha256Hex(json) };
}

export const sha256Hex = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/* ─── Builders ───────────────────────────────────────── */

const MAX_TRANSFERS = 200;

/** `0xd8dA6B…6045`: long identifiers don't wrap in PDFs without a misleading hyphen. */
export const shortForm = (value: string, head = 8, tail = 6) => (value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`);

function identityOf(subject: SubjectRef, display: string): { label: string; value: string }[] {
  if (subject.chain !== "stellar") return [{ label: "Address (EIP-55)", value: subject.address }];
  const rows = [{ label: "Base account", value: subject.account }];
  if (subject.sub?.kind === "muxed") {
    rows.push({ label: "Muxed address (SEP-23)", value: subject.sub.muxed }, { label: "Muxed ID", value: subject.sub.id });
  } else if (subject.sub?.kind === "memo") {
    rows.push({ label: `Memo (${subject.sub.type})`, value: subject.sub.value });
  }
  if (display !== subject.account && !rows.some((r) => r.value === display)) rows.push({ label: "Shown as", value: display });
  return rows;
}

function dataSourcesOf(chain: ChainId, horizonUrl?: string): string[] {
  const info = getChain(chain);
  if (chain === "stellar") return [`Stellar Horizon (${horizonUrl ?? "https://horizon.stellar.org"})`, "stellar.toml (SEP-1) at the account's home domain", "Hera label set"];
  const explorer = info ? new URL(info.explorerAddressUrl("0x0")).origin : "Blockscout";
  return [`${info?.name ?? chain} via Blockscout (${explorer})`, "Hera label set"];
}

export function buildEvidenceSnapshot(
  header: Omit<SnapshotHeader, "type" | "scope">,
  screening: { id: string; createdAt: Date; result: ScreeningResult },
  horizonUrl?: string,
): EvidenceSnapshot {
  const { result } = screening;
  const subjectAddress = result.subject.chain === "stellar" ? result.subject.account : result.subject.address.toLowerCase();
  const own = (address: string) => (result.subject.chain === "stellar" ? address === subjectAddress : address.toLowerCase() === subjectAddress);
  const transfers = [...result.transfers].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return {
    ...header,
    type: "screening_evidence",
    // Narrow header cell: the full identity is in the Subject section and the JSON.
    scope: `${shortForm(result.display)} on ${getChain(result.subject.chain)?.name ?? result.subject.chain}`,
    screening: {
      id: screening.id,
      screenedAt: result.screenedAt,
      recordedAt: screening.createdAt.toISOString(),
      chain: result.subject.chain,
      chainName: getChain(result.subject.chain)?.name ?? result.subject.chain,
      display: result.display,
      subject: result.subject,
      identity: identityOf(result.subject, result.display),
      score: result.score,
      band: result.band,
      decision: result.decision,
      engineVersion: result.engineVersion,
    },
    reasons: result.reasons.map((reason) => ({
      code: reason.code,
      title: reason.title,
      detail: reason.detail,
      points: reason.points,
      severity: reason.severity,
      ...(reason.evidence?.label
        ? {
            provenance: {
              entity: reason.evidence.label.entity,
              category: CATEGORY_LABEL[reason.evidence.label.category] ?? reason.evidence.label.category,
              source: reason.evidence.label.source,
              ...(reason.evidence.label.sourceUrl ? { sourceUrl: reason.evidence.label.sourceUrl } : {}),
              confidence: reason.evidence.label.confidence,
              addedAt: reason.evidence.label.addedAt,
            },
          }
        : {}),
      ...(reason.evidence?.txHashes?.length ? { txHashes: reason.evidence.txHashes } : {}),
      ...(reason.evidence?.counterparty ? { counterparty: reason.evidence.counterparty } : {}),
    })),
    counterparties: result.counterparties.map((c) => ({
      address: c.address,
      ...(c.muxedId ? { muxedId: c.muxedId } : {}),
      inbound: c.inbound,
      outbound: c.outbound,
      labels: c.labels.map((l) => `${l.entity} (${CATEGORY_LABEL[l.category] ?? l.category})`),
    })),
    transfers: transfers.slice(0, MAX_TRANSFERS).map((t) => {
      const outgoing = own(t.from.address);
      const incoming = own(t.to.address);
      return {
        timestamp: t.timestamp,
        txHash: t.txHash,
        kind: t.kind,
        direction: outgoing && incoming ? "self" : outgoing ? "out" : "in",
        counterparty: outgoing ? t.to.address : t.from.address,
        asset: t.asset.code,
        amount: t.amount,
        successful: t.successful,
      };
    }),
    transfersOmitted: Math.max(0, transfers.length - MAX_TRANSFERS),
    stats: result.stats,
    ...(result.profile.window
      ? {
          dataWindow: {
            pages: result.profile.window.pages,
            records: result.profile.window.records,
            ...(result.profile.window.truncatedBy ? { truncatedBy: result.profile.window.truncatedBy } : {}),
            ...(result.profile.window.oldest ? { oldest: result.profile.window.oldest } : {}),
            fullHistory: result.profile.fullHistory,
          },
        }
      : {}),
    ...(result.profile.delegatedTo ? { delegatedTo: result.profile.delegatedTo } : {}),
    dataSources: dataSourcesOf(result.subject.chain, horizonUrl),
  };
}

export function buildTravelRuleSnapshot(header: Omit<SnapshotHeader, "type" | "scope">, transfer: TravelRuleTransferDto): TravelRuleSnapshot {
  return {
    ...header,
    type: "travel_rule",
    scope: `Transfer ${transfer.reference}: ${transfer.amount} ${transfer.asset} (${transfer.direction})`,
    transfer,
    jurisdiction: getJurisdiction(transfer.jurisdiction),
  };
}

/* ─── Audit report methodology ───────────────────────── */

export const REASON_DESCRIPTIONS: Record<ReasonCode, string> = {
  SANCTIONS_DIRECT: "The subject itself is on a sanctions list. Forces score 100 and block.",
  CATEGORY_DIRECT: "The subject carries a high-risk label (e.g. mixer, stolen funds, darknet).",
  KNOWN_ENTITY: "The subject is a known, lower-risk entity such as an exchange or issuer.",
  COUNTERPARTY_EXPOSURE: "First-hop transfers with labelled high-risk counterparties, weighted by value.",
  FRESH_ACCOUNT: "The account was created recently.",
  HIGH_VELOCITY: "Unusually many transfers in a short window.",
  RAPID_IN_OUT: "Funds leave shortly after they arrive (pass-through behaviour).",
  STRUCTURING: "Repeated amounts just under reporting thresholds.",
  SHARED_ACCOUNT_NO_SUBACCOUNT: "An omnibus Stellar account was screened without its muxed ID or memo.",
  SUBACCOUNT_RESOLVED: "The muxed ID or memo was resolved, so only that customer's activity was scored.",
  UNVERIFIED_HOME_DOMAIN: "The account's home domain stellar.toml doesn't list it back.",
  CLAWBACK_ENABLED: "The issuer can claw back the asset.",
  NO_HISTORY: "No on-chain history was found.",
  SMART_CONTRACT: "The address is a contract, not an externally owned account.",
  EIP7702_DELEGATED: "The account delegates its code to a contract under EIP-7702.",
  FAILED_RISKY_ATTEMPT: "A failed or reverted attempt to transact with a high-risk counterparty.",
  CHAIN_DATA_PARTIAL: "Some chain data sources did not answer in time; the score uses the data that arrived and should be rescreened.",
};

export function methodology(alertThresholdPoints: number): AuditSnapshot["methodology"] {
  const sources = new Map<string, { url?: string; labels: number; categories: Set<string> }>();
  for (const label of SEED_LABELS) {
    const entry = sources.get(label.source) ?? { url: label.sourceUrl, labels: 0, categories: new Set<string>() };
    entry.labels++;
    entry.categories.add(CATEGORY_LABEL[label.category] ?? label.category);
    entry.url ??= label.sourceUrl;
    sources.set(label.source, entry);
  }
  return {
    bands: [
      { band: "low", range: "0–24", decision: "allow" },
      { band: "medium", range: "25–49", decision: "allow" },
      { band: "high", range: "50–74", decision: "review" },
      { band: "severe", range: "75–100", decision: "block" },
    ],
    reasonCodes: (Object.keys(REASON_DESCRIPTIONS) as ReasonCode[]).map((code) => ({ code, description: REASON_DESCRIPTIONS[code] })),
    alertThresholdPoints,
    categories: (Object.entries(CATEGORY_SEVERITY) as [LabelCategory, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([category, severity]) => ({ category, label: CATEGORY_LABEL[category] ?? category, severity })),
    labelSources: [...sources.entries()].map(([source, s]) => ({ source, ...(s.url ? { url: s.url } : {}), labels: s.labels, categories: [...s.categories] })),
    jurisdictions: JURISDICTIONS,
  };
}

export { ENGINE_VERSION };
