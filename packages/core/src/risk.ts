import { approxNumber, isUsdStablecoin } from "./amount";
import { CATEGORY_LABEL, CATEGORY_SEVERITY, isRiskCategory, type LabelIndex } from "./labels";
import { memoMatches } from "./stellar/memo";
import { looksLikeOmnibus, sharedAccountEvidence } from "./stellar/omnibus";
import { formatSubject, shortAddress, subjectAddress } from "./subject";
import type {
  CounterpartySummary,
  Decision,
  Label,
  LabelCategory,
  Party,
  Reason,
  RiskBand,
  ScreeningResult,
  SubjectProfile,
  SubjectRef,
  Transfer,
} from "./types";

/**
 * Bump whenever the same input can produce a different score, band, decision
 * or reason set. Stored with every screening so results can be reproduced.
 *
 * 2026.10.1: failed transfers and self-transfers excluded from scoring;
 *   cumulative-severity exposure (monotone); one-to-one pass-through matching;
 *   issuer-aware USD valuation; stricter shared-account rule; memo views are
 *   inbound only; EIP-7702 delegated wallets; claimable-balance claims.
 * 2026.10.2: slow or failed sources degrade to partial data (CHAIN_DATA_PARTIAL)
 *   instead of failing the screen; labeled subjects are always scored.
 */
export const ENGINE_VERSION = "2026.10.2";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Hop decay for counterparty exposure; phase 1 scores first-hop only. */
export const FIRST_HOP_DECAY = 0.85;
export const BEHAVIOR_CAP = 30;
const STRUCTURING_THRESHOLDS_USD = [3_000, 10_000];
/** Pass-through matching looks at most this many candidate outflows per inflow. */
const PASS_THROUGH_SCAN = 256;

export interface ScoreInput {
  subject: SubjectRef;
  profile: SubjectProfile;
  /** Every transfer fetched for the base account. The engine narrows it to the sub-account. */
  transfers: Transfer[];
  dustFiltered?: number;
  labels: LabelIndex;
  now?: Date;
}

export function bandFor(score: number): RiskBand {
  if (score >= 75) return "severe";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export function decisionFor(band: RiskBand): Decision {
  if (band === "severe") return "block";
  if (band === "high") return "review";
  return "allow";
}

/**
 * Whether a transfer party is the subject. For a muxed subject that means the
 * same base account *and* the same muxed id: a payment from M…42 to M…7 under
 * one exchange account is an outflow to another customer, not a self-transfer.
 */
export function isSubjectParty(subject: SubjectRef, party: Party): boolean {
  if (subject.chain !== "stellar") return party.address === subject.address || party.address.toLowerCase() === subject.address.toLowerCase();
  if (party.address !== subject.account) return false;
  return subject.sub?.kind === "muxed" ? party.muxedId === subject.sub.id : true;
}

/** Newest first, ties broken by id, so the output never depends on input order. */
function sortNewestFirst(transfers: Transfer[]): Transfer[] {
  return transfers
    .map((t) => ({ t, at: Date.parse(t.timestamp) }))
    .sort((a, b) => b.at - a.at || (a.t.id < b.t.id ? -1 : a.t.id > b.t.id ? 1 : 0))
    .map((x) => x.t);
}

/**
 * The subject's own view of the ledger, newest first. For a muxed id, the
 * transfers to or from that M… address. For a memo, the payments *into* the
 * account carrying that memo: a memo routes a payment to its destination's
 * customer, so a memo on an outbound payment names someone else's customer.
 */
export function transfersForSubject(subject: SubjectRef, transfers: Transfer[]): Transfer[] {
  if (subject.chain !== "stellar" || !subject.sub) return transfers;
  const { account, sub } = subject;

  if (sub.kind === "muxed") {
    return transfers.filter((t) => isSubjectParty(subject, t.to) || isSubjectParty(subject, t.from));
  }
  return transfers.filter((t) => t.to.address === account && memoMatches(sub, t.memo));
}

/** A transfer as the scorer sees it. */
interface Row {
  t: Transfer;
  at: number;
  inbound: boolean;
  other: Party;
  key: string;
  /** Approximate amount, for heuristics only. */
  amount: number;
  /** USD value when the asset is a known stablecoin. */
  usd?: number;
}

const partyKey = (party: Party) => `${party.address}:${party.muxedId ?? ""}`;

function toRows(subject: SubjectRef, view: Transfer[]): { rows: Row[]; self: number } {
  const rows: Row[] = [];
  let self = 0;
  for (const t of view) {
    const toSubject = isSubjectParty(subject, t.to);
    const fromSubject = isSubjectParty(subject, t.from);
    if (toSubject && fromSubject) {
      self++;
      continue;
    }
    const other = toSubject ? t.from : t.to;
    const amount = approxNumber(t.amount);
    rows.push({ t, at: Date.parse(t.timestamp), inbound: toSubject, other, key: partyKey(other), amount, usd: isUsdStablecoin(subject.chain, t.asset) ? amount : undefined });
  }
  return { rows, self };
}

function summarizeCounterparties(subject: SubjectRef, rows: Row[], labels: LabelIndex): CounterpartySummary[] {
  const map = new Map<string, CounterpartySummary>();
  for (const row of rows) {
    let entry = map.get(row.key);
    if (!entry) {
      entry = { address: row.other.address, muxedId: row.other.muxedId, inbound: 0, outbound: 0, labels: labels.get(subject.chain, row.other.address) };
      map.set(row.key, entry);
    }
    if (row.inbound) entry.inbound++;
    else entry.outbound++;
  }
  return [...map.values()].sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound));
}

function directReasons(labels: Label[]): Reason[] {
  return labels.map((label): Reason => {
    if (label.category === "sanctions") {
      return {
        code: "SANCTIONS_DIRECT",
        points: 100,
        severity: "critical",
        title: "Sanctioned address",
        detail: `${label.entity}, listed on ${label.source}. Transactions with this address are prohibited.`,
        evidence: { label },
      };
    }
    if (isRiskCategory(label.category)) {
      return {
        code: "CATEGORY_DIRECT",
        points: CATEGORY_SEVERITY[label.category],
        severity: CATEGORY_SEVERITY[label.category] >= 75 ? "high" : "medium",
        title: `Address is a known ${CATEGORY_LABEL[label.category].toLowerCase()}`,
        detail: `${label.entity} (source: ${label.source}).${label.note ? ` ${label.note}` : ""}`,
        evidence: { label },
      };
    }
    return {
      code: "KNOWN_ENTITY",
      points: 0,
      severity: "info",
      title: `Known ${CATEGORY_LABEL[label.category].toLowerCase()}: ${label.entity}`,
      detail: `Attributed by ${label.source} with ${Math.round(label.confidence * 100)}% confidence.`,
      evidence: { label },
    };
  });
}

/** Highest risk severity among a counterparty's labels, 0 when it has none. */
function riskSeverity(labels: Label[]): number {
  let max = 0;
  for (const label of labels) if (isRiskCategory(label.category)) max = Math.max(max, CATEGORY_SEVERITY[label.category]);
  return max;
}

/** Exposure points for a category, given the share of activity at that severity or worse. */
export function exposurePoints(severity: number, share: number): number {
  // Any contact counts for half the severity; heavier contact scales to the full amount.
  return Math.round(severity * (0.5 + 0.5 * Math.min(1, share * 5)) * FIRST_HOP_DECAY);
}

/**
 * First-hop counterparty exposure. For each risky category c the share is the
 * fraction of scored transfers whose counterparty is at least as severe as c.
 * Cumulative shares make the score monotone: more contact with a sanctioned
 * party can never dilute (and so lower) the exposure to a mixer.
 */
function exposureReasons(rows: Row[], counterparties: Map<string, CounterpartySummary>): Reason[] {
  const total = rows.length;
  if (total === 0) return [];

  const severityOf = new Map<string, number>();
  for (const [key, cp] of counterparties) severityOf.set(key, riskSeverity(cp.labels));
  const rowSeverities = rows.map((row) => severityOf.get(row.key) ?? 0);

  const byCategory = new Map<LabelCategory, { interactions: number; parties: CounterpartySummary[] }>();
  for (const cp of counterparties.values()) {
    for (const label of cp.labels) {
      if (!isRiskCategory(label.category)) continue;
      const entry = byCategory.get(label.category) ?? { interactions: 0, parties: [] };
      if (entry.parties.includes(cp)) continue;
      entry.interactions += cp.inbound + cp.outbound;
      entry.parties.push(cp);
      byCategory.set(label.category, entry);
    }
  }

  return [...byCategory.entries()].map(([category, { interactions, parties }]) => {
    const severity = CATEGORY_SEVERITY[category];
    const atLeast = rowSeverities.filter((s) => s >= severity).length;
    const share = atLeast / total;
    const points = exposurePoints(severity, share);
    const top = parties[0]!;
    const partyKeys = new Set(parties.map((p) => partyKey(p)));
    const txHashes = [...new Set(rows.filter((row) => partyKeys.has(row.key)).map((row) => row.t.txHash))].slice(0, 5);
    const pct = (n: number) => Math.round((n / total) * 100);
    return {
      code: "COUNTERPARTY_EXPOSURE",
      points,
      severity: points >= 75 ? "critical" : points >= 50 ? "high" : "medium",
      title: `Direct exposure to ${CATEGORY_LABEL[category].toLowerCase()}`,
      detail:
        `${interactions} of ${total} transfers (${pct(interactions)}%) involve ${top.labels[0]?.entity ?? shortAddress(top.address)}${parties.length > 1 ? ` and ${parties.length - 1} other` : ""}.` +
        (atLeast > interactions ? ` ${pct(atLeast)}% of activity is with counterparties this severe or worse.` : ""),
      evidence: { counterparty: top.address, txHashes, label: top.labels.find((l) => l.category === category) },
    } satisfies Reason;
  });
}

/**
 * Inflows that left again within an hour at 90–100% of their value, matched
 * one-to-one: one large withdrawal cannot "explain" many small deposits.
 */
function passThrough(rows: Row[]): { matched: Row[]; inbound: number } {
  const inbound = rows.filter((r) => r.inbound && r.amount > 0).sort((a, b) => a.at - b.at);
  const outByAsset = new Map<string, { row: Row; amount: number; used: boolean }[]>();
  for (const r of rows) {
    if (r.inbound) continue;
    const key = `${r.t.asset.code}:${r.t.asset.issuer ?? ""}`;
    const list = outByAsset.get(key) ?? [];
    list.push({ row: r, amount: r.amount, used: false });
    outByAsset.set(key, list);
  }
  for (const list of outByAsset.values()) list.sort((a, b) => a.row.at - b.row.at);

  const matched: Row[] = [];
  for (const tin of inbound) {
    const list = outByAsset.get(`${tin.t.asset.code}:${tin.t.asset.issuer ?? ""}`);
    if (!list) continue;
    const amount = tin.amount;
    // First outflow at or after the inflow (binary search).
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.row.at < tin.at) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo, scanned = 0; i < list.length && scanned < PASS_THROUGH_SCAN; i++, scanned++) {
      const out = list[i]!;
      if (out.row.at - tin.at > HOUR) break;
      if (!out.used && out.amount >= amount * 0.9 && out.amount <= amount * 1.0001) {
        out.used = true;
        matched.push(tin);
        break;
      }
    }
  }
  return { matched, inbound: inbound.length };
}

function behaviorReasons(subject: SubjectRef, profile: SubjectProfile, rows: Row[], now: Date): Reason[] {
  const reasons: Reason[] = [];
  const nowMs = now.getTime();

  if (profile.createdAt && nowMs - Date.parse(profile.createdAt) < 7 * DAY) {
    reasons.push({
      code: "FRESH_ACCOUNT",
      points: 15,
      severity: "medium",
      title: "Brand-new account",
      detail: `Created ${new Date(profile.createdAt).toUTCString()}. Fresh accounts are common in fraud and layering.`,
    });
  }

  const lastDay = rows.filter((r) => nowMs - r.at < DAY && r.at <= nowMs).length;
  if (lastDay >= 50) {
    reasons.push({
      code: "HIGH_VELOCITY",
      points: 10,
      severity: "low",
      title: "High transaction velocity",
      detail: `${lastDay} transfers in the last 24 hours.`,
    });
  }

  const { matched, inbound } = passThrough(rows);
  if (inbound >= 3 && matched.length / inbound >= 0.5) {
    reasons.push({
      code: "RAPID_IN_OUT",
      points: 15,
      severity: "medium",
      title: "Funds pass straight through",
      detail: `${matched.length} of ${inbound} inbound transfers left again within an hour at 90% or more of their value.`,
      evidence: { txHashes: matched.slice(0, 5).map((r) => r.t.txHash) },
    });
  }

  for (const threshold of STRUCTURING_THRESHOLDS_USD) {
    const near = rows
      .filter((r) => r.usd !== undefined && r.usd >= threshold * 0.9 && r.usd < threshold)
      .sort((a, b) => a.at - b.at);
    // Sliding 24h window over just-below-threshold transfers.
    let start = 0;
    let best = { start: 0, size: 0 };
    for (let end = 0; end < near.length; end++) {
      while (near[end]!.at - near[start]!.at > DAY) start++;
      if (end - start + 1 > best.size) best = { start, size: end - start + 1 };
    }
    if (best.size >= 3) {
      const worst = near.slice(best.start, best.start + best.size);
      reasons.push({
        code: "STRUCTURING",
        points: 20,
        severity: "high",
        title: "Possible structuring",
        detail: `${worst.length} transfers just under $${threshold.toLocaleString("en-US")} within 24 hours.`,
        evidence: { txHashes: worst.slice(0, 5).map((r) => r.t.txHash) },
      });
      break;
    }
  }

  return reasons;
}

function stellarReasons(
  subject: Extract<SubjectRef, { chain: "stellar" }>,
  profile: SubjectProfile,
  labels: Label[],
  view: Transfer[],
  all: Transfer[],
): Reason[] {
  const reasons: Reason[] = [];
  const toml = profile.toml;

  if (toml?.status === "verified") {
    reasons.push({
      code: "KNOWN_ENTITY",
      points: 0,
      severity: "info",
      title: `Verified home domain: ${toml.domain}`,
      detail: `${toml.orgName ?? toml.domain}'s stellar.toml lists this account${toml.seps.length > 1 ? ` and advertises ${toml.seps.join(", ")}` : ""}.`,
    });
  } else if (toml?.status === "unlisted") {
    reasons.push({
      code: "UNVERIFIED_HOME_DOMAIN",
      points: 10,
      severity: "medium",
      title: `Home domain doesn't vouch for this account`,
      detail: `The account claims ${toml.domain}, but that domain's stellar.toml doesn't list it. Anyone can set a home domain, so treat the claim as unproven.`,
    });
  }

  if (subject.sub) {
    const what = subject.sub.kind === "muxed" ? `muxed ID ${subject.sub.id}` : `memo ${subject.sub.type} "${subject.sub.value}"`;
    reasons.push({
      code: "SUBACCOUNT_RESOLVED",
      points: 0,
      severity: "info",
      title: "Screened at the sub-account level",
      detail: `Scored ${what} under ${shortAddress(subject.account)}: ${view.length} of ${all.length} recent transfers belong to this customer.`,
    });
  } else {
    // Issuers are not customer omnibus accounts; labeled exchanges and anchors always are.
    const isIssuer = labels.some((l) => l.category === "issuer");
    const labeledOmnibus = labels.some((l) => l.category === "exchange" || l.category === "anchor");
    const evidence = sharedAccountEvidence(subject.account, all);
    if (labeledOmnibus || (!isIssuer && looksLikeOmnibus(evidence))) {
      reasons.push({
        code: "SHARED_ACCOUNT_NO_SUBACCOUNT",
        points: 5,
        severity: "low",
        title: "Shared account: who is the customer?",
        detail:
          (evidence.eligibleInbound
            ? `${evidence.routedInbound} of ${evidence.eligibleInbound} inbound payments (${Math.round(evidence.ratio * 100)}%) carry a muxed ID or memo ID, across ${evidence.distinctRoutes} distinct customers, so this address likely serves many customers.`
            : "This address is a known exchange or anchor and likely serves many customers.") +
          " Screen the M… address or memo to identify the actual counterparty.",
      });
    }
  }

  if (profile.flags?.clawbackEnabled) {
    reasons.push({
      code: "CLAWBACK_ENABLED",
      points: 0,
      severity: "info",
      title: "Issuer can claw back assets",
      detail: "Assets issued by this account can be clawed back. Expected for regulated assets; holders should know.",
    });
  }
  return reasons;
}

function delegationReason(subject: SubjectRef, profile: SubjectProfile, labels: LabelIndex): Reason[] {
  if (!profile.delegatedTo) return [];
  const delegateLabels = labels.get(subject.chain, profile.delegatedTo);
  const risky = delegateLabels.filter((l) => isRiskCategory(l.category)).sort((a, b) => CATEGORY_SEVERITY[b.category] - CATEGORY_SEVERITY[a.category])[0];
  const known = delegateLabels[0];
  const name = known ? `${known.entity} (${shortAddress(profile.delegatedTo)})` : shortAddress(profile.delegatedTo);
  if (risky) {
    const points = Math.round(CATEGORY_SEVERITY[risky.category] * FIRST_HOP_DECAY);
    return [{
      code: "EIP7702_DELEGATED",
      points,
      severity: points >= 75 ? "critical" : points >= 50 ? "high" : "medium",
      title: `Wallet delegates to a known ${CATEGORY_LABEL[risky.category].toLowerCase()}`,
      detail: `This EOA has set its code to ${name} via EIP-7702. Funds sent here run that contract's logic; delegations to sweepers are a common sign of a compromised key.`,
      evidence: { label: risky, counterparty: profile.delegatedTo },
    }];
  }
  return [{
    code: "EIP7702_DELEGATED",
    points: 0,
    severity: "info",
    title: "Wallet with delegated code (EIP-7702)",
    detail: `A key-controlled wallet that delegates its code to ${name}. Treated as a wallet, not a contract.`,
    evidence: { counterparty: profile.delegatedTo },
  }];
}

/** Failed transfers never score, but an attempt to move value with a flagged party is worth a look. */
function failedAttemptReason(subject: SubjectRef, failed: Transfer[], labels: LabelIndex): Reason[] {
  const hits: { t: Transfer; label: Label }[] = [];
  for (const t of failed) {
    const other = isSubjectParty(subject, t.to) ? t.from : t.to;
    if (isSubjectParty(subject, other)) continue;
    const label = labels.get(subject.chain, other.address).find((l) => isRiskCategory(l.category));
    if (label) hits.push({ t, label });
  }
  if (!hits.length) return [];
  const first = hits[0]!;
  return [{
    code: "FAILED_RISKY_ATTEMPT",
    points: 0,
    severity: "info",
    title: "Failed transfers with a flagged counterparty",
    detail: `${hits.length} failed transfer${hits.length > 1 ? "s" : ""} involved ${first.label.entity} (${CATEGORY_LABEL[first.label.category].toLowerCase()}). Failed transactions move no value and are not scored, but the attempt may need review.`,
    evidence: { label: first.label, counterparty: first.label.address, txHashes: [...new Set(hits.map((h) => h.t.txHash))].slice(0, 5) },
  }];
}

export function scoreSubject(input: ScoreInput): ScreeningResult {
  const now = input.now ?? new Date();
  const { subject, profile, labels } = input;
  const address = subjectAddress(subject);
  const view = sortNewestFirst(transfersForSubject(subject, input.transfers));
  const successful = view.filter((t) => t.successful);
  const failed = view.filter((t) => !t.successful);
  const { rows } = toRows(subject, successful);
  const ownLabels = labels.get(subject.chain, address);
  const counterpartyMap = new Map<string, CounterpartySummary>();
  for (const cp of summarizeCounterparties(subject, rows, labels)) counterpartyMap.set(partyKey(cp), cp);
  const counterparties = [...counterpartyMap.values()];

  const reasons: Reason[] = [
    ...directReasons(ownLabels),
    ...exposureReasons(rows, counterpartyMap),
    ...delegationReason(subject, profile, labels),
    ...behaviorReasons(subject, profile, rows, now),
    ...(subject.chain === "stellar" ? stellarReasons(subject, profile, ownLabels, view, input.transfers) : []),
    ...failedAttemptReason(subject, failed, labels),
  ];

  if (!profile.exists || rows.length === 0) {
    reasons.push({
      code: "NO_HISTORY",
      points: 0,
      severity: "info",
      title: !profile.exists ? "Never seen on-chain" : view.length ? "No successful transfers in the recent window" : "No transfers in the recent window",
      detail: !profile.exists
        ? "This address has no on-chain activity. It may be new or mistyped."
        : "There is nothing recent to score against. Treat as unknown rather than clean.",
    });
  }
  if (profile.dataStatus === "partial" || profile.dataStatus === "unavailable") {
    const missing = profile.window?.missing?.filter((m) => m !== "all") ?? [];
    const why = profile.window?.truncatedBy === "deadline" ? "did not answer in time" : "returned an error";
    reasons.push({
      code: "CHAIN_DATA_PARTIAL",
      points: 0,
      severity: "info",
      title: profile.dataStatus === "unavailable" ? "Scored without chain data" : "Scored on incomplete chain data",
      detail:
        profile.dataStatus === "unavailable"
          ? `No chain data source ${why}, so this score rests on Hera's labels for the address alone. Rescreen to include activity.`
          : `The ${missing.join(", ")} source${missing.length === 1 ? "" : "s"} ${why}, so this score rests on incomplete data and may understate exposure. Rescreen when the source recovers.`,
    });
  }
  if (profile.isContract && !profile.delegatedTo) {
    reasons.push({
      code: "SMART_CONTRACT",
      points: 0,
      severity: "info",
      title: "Smart contract",
      detail: "This is a contract, not a wallet. Check who controls it before treating it as a counterparty.",
    });
  }

  const pointsOf = (...codes: Reason["code"][]) => reasons.filter((r) => codes.includes(r.code)).map((r) => r.points);
  const direct = Math.max(0, ...pointsOf("SANCTIONS_DIRECT", "CATEGORY_DIRECT"));
  const exposure = Math.max(0, ...pointsOf("COUNTERPARTY_EXPOSURE", "EIP7702_DELEGATED"));
  const behavior = Math.min(
    BEHAVIOR_CAP,
    pointsOf("FRESH_ACCOUNT", "HIGH_VELOCITY", "RAPID_IN_OUT", "STRUCTURING", "SHARED_ACCOUNT_NO_SUBACCOUNT", "UNVERIFIED_HOME_DOMAIN").reduce((a, b) => a + b, 0),
  );
  const knownGood = ownLabels.some((l) => !isRiskCategory(l.category)) || profile.toml?.status === "verified";
  const baseline = knownGood ? 2 : rows.length === 0 ? 10 : 5;

  const sanctioned = reasons.some((r) => r.code === "SANCTIONS_DIRECT");
  const score = sanctioned ? 100 : Math.min(100, Math.max(direct, exposure, behavior + baseline));
  const band = bandFor(score);

  const inbound = view.filter((t) => isSubjectParty(subject, t.to)).length;

  return {
    subject,
    display: formatSubject(subject),
    score,
    band,
    decision: sanctioned ? "block" : decisionFor(band),
    reasons: reasons.sort((a, b) => b.points - a.points),
    profile,
    counterparties: counterparties.slice(0, 25),
    transfers: view.slice(0, 100),
    stats: {
      transfers: view.length,
      inbound,
      outbound: view.length - inbound,
      dustFiltered: input.dustFiltered ?? 0,
      failed: failed.length,
      firstSeen: view.at(-1)?.timestamp,
      lastSeen: view[0]?.timestamp,
    },
    screenedAt: now.toISOString(),
    engineVersion: ENGINE_VERSION,
  };
}
