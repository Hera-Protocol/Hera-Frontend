import type { EvmAddress } from "./evm/address";

/* ─── Chains ─────────────────────────────────────────── */

export type ChainId = "stellar" | `evm:${number}`;

export type ChainFamily = "stellar" | "evm";

export interface ChainInfo {
  id: ChainId;
  family: ChainFamily;
  name: string;
  nativeSymbol: string;
  nativeDecimals: number;
  explorerTxUrl: (hash: string) => string;
  explorerAddressUrl: (address: string) => string;
  /** Whether live screening is enabled for this chain. */
  live: boolean;
}

/* ─── Subjects ───────────────────────────────────────── */

export type StellarSubAccount =
  | { kind: "muxed"; id: string; muxed: string }
  | { kind: "memo"; type: "id" | "text" | "hash"; value: string };

/**
 * The thing being screened. Never a bare string: on Stellar the real
 * counterparty is often a muxed id or memo under a shared `G…` account,
 * and that distinction must survive every downstream check.
 * Muxed ids are decimal strings so the type stays JSON-safe (uint64 > 2^53).
 */
export type SubjectRef =
  | { chain: "stellar"; account: string; sub?: StellarSubAccount }
  | { chain: `evm:${number}`; address: EvmAddress };

/* ─── Transfers ──────────────────────────────────────── */

export const TRANSFER_KINDS = [
  "payment",
  "path_payment",
  "create_account",
  "merge",
  "native",
  "erc20",
  "erc721",
  "erc1155",
  /** Stellar: a claimable balance being claimed. Value moves at claim time, not at creation. */
  "claim",
] as const;

export type TransferKind = (typeof TRANSFER_KINDS)[number];

export interface Party {
  address: string;
  /** Stellar only: decoded SEP-23 id when the operation used an `M…` address. */
  muxedId?: string;
}

export interface Asset {
  code: string;
  /** Stellar issuer `G…` or EVM token contract. Undefined for native assets. */
  issuer?: string;
  decimals: number;
}

export interface Transfer {
  id: string;
  chain: ChainId;
  txHash: string;
  timestamp: string;
  kind: TransferKind;
  from: Party;
  to: Party;
  asset: Asset;
  /** Decimal string. Never a float. */
  amount: string;
  /**
   * Stellar memo from the transaction. `hash` and `return` memos are normalized
   * to lowercase hex (Horizon serves them base64-encoded).
   */
  memo?: { type: string; value: string };
  /**
   * False for reverted EVM transactions and failed internal calls. Unsuccessful
   * transfers are kept for display but never counted in scoring.
   */
  successful: boolean;
  /** Path payments: what the sender actually spent, which may be a different (riskier) asset. */
  sourceAsset?: Asset;
  sourceAmount?: string;
}

/* ─── Labels (Hera's own intelligence) ───────────────── */

export const LABEL_CATEGORIES = [
  "sanctions",
  "terrorist_financing",
  "stolen_funds",
  "ransomware",
  "darknet",
  "mixer",
  "scam",
  "gambling",
  "high_risk_exchange",
  "bridge",
  "exchange",
  "anchor",
  "issuer",
  "defi",
] as const;

export type LabelCategory = (typeof LABEL_CATEGORIES)[number];

export interface Label {
  chain: ChainId;
  address: string;
  category: LabelCategory;
  entity: string;
  /** Where this label comes from. Every label must be explainable. */
  source: string;
  sourceUrl?: string;
  /** 0–1 */
  confidence: number;
  addedAt: string;
  note?: string;
}

/* ─── Profiles ───────────────────────────────────────── */

export interface StellarTomlSummary {
  domain: string;
  orgName?: string;
  /**
   * verified:    the toml lists this account back, so the domain claim holds.
   * unlisted:    the toml was read but does not list this account (possible impersonation).
   * unavailable: no readable toml at the domain. Common, and not evidence of anything.
   */
  status: "verified" | "unlisted" | "unavailable";
  signingKey?: string;
  seps: string[];
}

export interface SubjectProfile {
  exists: boolean;
  /** Only set when the account's creation is actually observed, never inferred from a truncated window. */
  createdAt?: string;
  firstSeen?: string;
  /** Total transfers observed in the fetched window (before sub-account filtering). */
  observedTransfers: number;
  /** True when the fetched window covers the account's full history. */
  fullHistory: boolean;
  nativeBalance?: string;
  // Stellar
  homeDomain?: string;
  toml?: StellarTomlSummary;
  flags?: { authRequired: boolean; authRevocable: boolean; clawbackEnabled: boolean };
  /** Inbound payments to the base account that used a muxed id or memo, a sign of an omnibus account. */
  sharedAccountRatio?: number;
  // EVM
  /** True only for deployed contracts. EIP-7702 delegated EOAs are wallets and report false. */
  isContract?: boolean;
  /** EIP-7702: the contract this EOA delegates its code to. */
  delegatedTo?: string;
  ensName?: string;
  /** What the adapter actually read, so a reviewer can judge how much history the score rests on. */
  window?: DataWindow;
  /**
   * complete:    every source answered (later pages may still be cut by the page budget; see `window`).
   * partial:     at least one source returned nothing (timeout or error); the score rests on what did.
   * unavailable: no source answered. Only returned when the subject has direct labels to score on.
   * Absent on results from engines before 2026.10.2; treat absent as complete.
   */
  dataStatus?: "complete" | "partial" | "unavailable";
}

export interface DataWindow {
  /** Pages fetched per paged endpoint, e.g. `{ payments: 3 }`. */
  pages: Record<string, number>;
  /** Raw records read across all paged endpoints, before normalization and filtering. */
  records: number;
  /** Set when paging stopped while the source still had older data. */
  truncatedBy?: "page_budget" | "deadline" | "error";
  /** Stellar: claimable-balance claims resolved into transfers, and claims seen but not resolved. */
  claimsResolved?: number;
  claimsSkipped?: number;
  /** Oldest record timestamp in the window. */
  oldest?: string;
  /** Sources that returned nothing, e.g. `["payments"]` or `["account", "transactions"]`. */
  missing?: string[];
}

/* ─── Screening result ───────────────────────────────── */

export type RiskBand = "low" | "medium" | "high" | "severe";
export type Decision = "allow" | "review" | "block";

export const REASON_CODES = [
  "SANCTIONS_DIRECT",
  "CATEGORY_DIRECT",
  "KNOWN_ENTITY",
  "COUNTERPARTY_EXPOSURE",
  "FRESH_ACCOUNT",
  "HIGH_VELOCITY",
  "RAPID_IN_OUT",
  "STRUCTURING",
  "SHARED_ACCOUNT_NO_SUBACCOUNT",
  "SUBACCOUNT_RESOLVED",
  "UNVERIFIED_HOME_DOMAIN",
  "CLAWBACK_ENABLED",
  "NO_HISTORY",
  "SMART_CONTRACT",
  "EIP7702_DELEGATED",
  "FAILED_RISKY_ATTEMPT",
  "CHAIN_DATA_PARTIAL",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export interface Reason {
  code: ReasonCode;
  /** Points this reason contributes, 0 for informational reasons. */
  points: number;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  evidence?: { label?: Label; txHashes?: string[]; counterparty?: string };
}

export interface CounterpartySummary {
  address: string;
  muxedId?: string;
  inbound: number;
  outbound: number;
  labels: Label[];
}

export interface ScreeningResult {
  subject: SubjectRef;
  display: string;
  score: number;
  band: RiskBand;
  decision: Decision;
  reasons: Reason[];
  profile: SubjectProfile;
  counterparties: CounterpartySummary[];
  transfers: Transfer[];
  stats: {
    transfers: number;
    inbound: number;
    outbound: number;
    dustFiltered: number;
    /** Transfers in the view that failed on-chain. Included in `transfers`, excluded from scoring. */
    failed?: number;
    firstSeen?: string;
    lastSeen?: string;
  };
  screenedAt: string;
  engineVersion: string;
}
