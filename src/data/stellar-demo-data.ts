/**
 * Stellar Compliance Demo — mock data for /stellar/demo
 * Demonstrates native SEP protocol support, muxed account resolution,
 * pre-settlement enforcement (SEP-8), and end-to-end Anchor compliance.
 */

/* ─── SEP Protocol Types ─────────────────────────────── */

export type SepProtocol = "SEP-10" | "SEP-12" | "SEP-9" | "SEP-8";

export interface Sep10Auth {
  account: string;
  memo?: string;
  memo_type?: "text" | "hash" | "id";
  home_domain: string;
  web_auth_endpoint: string;
  challenge_tx: string;
  signed_at: string;
  verified: boolean;
  client_domain?: string;
}

export interface Sep9Field {
  field_name: string;
  description: string;
  value: string;
  status: "accepted" | "pending" | "rejected" | "needs_info";
}

export interface Sep12KycSubmission {
  id: string;
  account: string;
  memo?: string;
  memo_type?: string;
  type: "individual" | "organization";
  status: "approved" | "pending" | "rejected" | "needs_info";
  fields_provided: Sep9Field[];
  submitted_at: string;
  updated_at: string;
  kyc_level: "basic" | "standard" | "enhanced";
}

export interface Sep8Approval {
  tx_hash: string;
  status: "approved" | "rejected" | "revised" | "pending";
  reason?: string;
  action_required?: string;
  regulated_asset: string;
  checked_at: string;
  sanctions_check: boolean;
  travel_rule_check: boolean;
  amount_threshold_check: boolean;
}

/* ─── Account Resolution Types ───────────────────────── */

export type AccountForm = "G_address" | "M_muxed" | "G_memo";

export interface ResolvedAccount {
  display: string;
  form: AccountForm;
  federation_address?: string;
  g_address: string;
  muxed_address?: string;
  muxed_id?: string;
  memo?: string;
  memo_type?: string;
  kyc_status: "verified" | "pending" | "unverified" | "blocked";
  risk_rating: "low" | "medium" | "high" | "critical";
  customer_id: string;
}

/* ─── Transaction / Event Types ──────────────────────── */

export type StellarEventType = "PAYMENT" | "PATH_PAYMENT" | "CREATE_ACCOUNT" | "CLAWBACK" | "FEE";

export interface StellarDemoEvent {
  event_id: string;
  event_type: StellarEventType;
  tx_hash: string;
  ledger: number;
  timestamp: string;
  asset: { code: string; issuer?: string; type: "native" | "credit_alphanum4" | "credit_alphanum12" };
  amount: string;
  source_account: ResolvedAccount;
  destination_account: ResolvedAccount;
  memo?: { type: "text" | "hash" | "return" | "id" | "none"; value?: string };
  sep8_approval?: Sep8Approval;
  travel_rule?: {
    originator: string;
    beneficiary: string;
    originator_vasp: string;
    beneficiary_vasp: string;
  };
  compliance_flags: string[];
}

/* ─── Report Types ───────────────────────────────────── */

export interface StellarDemoReportSummary {
  audit_start: string;
  audit_end: string;
  total_payments: number;
  total_volume_usd: string;
  unique_assets: string[];
  unique_accounts: number;
  kyc_coverage: string;
  sanctions_hits: number;
  sep8_rejections: number;
  event_type_counts: Record<string, number>;
}

export interface StellarDemoReport {
  manifest_version: string;
  chain: string;
  network: string;
  generated_at: string;
  total_events: number;
  summary: StellarDemoReportSummary;
  events: StellarDemoEvent[];
  sep10_sessions: Sep10Auth[];
  sep12_submissions: Sep12KycSubmission[];
  sep8_approvals: Sep8Approval[];
  signature: {
    algorithm: string;
    public_key_hex: string;
    signature_hex: string;
    signed_at: string;
  };
}

export interface StellarDemoResponse {
  case_id: string;
  mode: "compliance" | "kyt";
  report: StellarDemoReport;
}

/* ─── Mock Data ──────────────────────────────────────── */

export const STELLAR_DEMO_CASE_ID = "stl-7a8b9c0d-e1f2-3456-7890-abcdef123456";

const resolvedAccounts: Record<string, ResolvedAccount> = {
  anchor_ops: {
    display: "GCKF...Q4XR",
    form: "G_address",
    federation_address: "ops*exampleanchor.com",
    g_address: "GCKFBEIYV2U22IO2BJ4KVJEP7OCOJKEVYLLIV4TDW2CJSDXQ4XRKQ4XR",
    kyc_status: "verified",
    risk_rating: "low",
    customer_id: "cust-001-anchor-ops",
  },
  muxed_customer_a: {
    display: "MBRG...W7NA",
    form: "M_muxed",
    federation_address: "alice*exampleanchor.com",
    g_address: "GBRGZ4GOYHOQF65HNNZ5KEAXH74WA5VFZ6VBETMRCRNMVL5SQDQW7NA",
    muxed_address: "MBRGZ4GOYHOQF65HNNZ5KEAXH74WA5VFZ6VBETMRCRNMVL5SQDQAAAAAAV3MHP4",
    muxed_id: "100001",
    kyc_status: "verified",
    risk_rating: "low",
    customer_id: "cust-100001",
  },
  muxed_customer_b: {
    display: "MBRG...K3PB",
    form: "M_muxed",
    g_address: "GBRGZ4GOYHOQF65HNNZ5KEAXH74WA5VFZ6VBETMRCRNMVL5SQDQW7NA",
    muxed_address: "MBRGZ4GOYHOQF65HNNZ5KEAXH74WA5VFZ6VBETMRCRNMVL5SQDQAAAAAAV3K3PB",
    muxed_id: "100002",
    kyc_status: "verified",
    risk_rating: "medium",
    customer_id: "cust-100002",
  },
  memo_customer: {
    display: "GDQP...8F2A + memo:42",
    form: "G_memo",
    g_address: "GDQP5OGZ4CRSXH7V3DNHKZ3RQXOWVMHJ5LFBZQVBKGDCVL2X7R08F2A",
    memo: "42",
    memo_type: "id",
    kyc_status: "pending",
    risk_rating: "medium",
    customer_id: "cust-memo-42",
  },
  external_exchange: {
    display: "GBDE...9KL4",
    form: "G_address",
    g_address: "GBDEPOSITSXN3WA34SGFK23CPFHQK3AWNF5AUXT6QPJZOGKC4BIJ9KL4",
    kyc_status: "unverified",
    risk_rating: "high",
    customer_id: "ext-exchange-unverified",
  },
  sanctioned_entity: {
    display: "GSANC...BLK1",
    form: "G_address",
    g_address: "GSANCLISTWARNING4BLOCKED5ENTITY6FLAGGED7OFAC8HITBLK1",
    kyc_status: "blocked",
    risk_rating: "critical",
    customer_id: "blocked-entity-001",
  },
};

const mockEvents: StellarDemoEvent[] = [
  {
    event_id: "evt-stl-001",
    event_type: "PAYMENT",
    tx_hash: "a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
    ledger: 52_400_100,
    timestamp: "2026-06-15T08:30:00Z",
    asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", type: "credit_alphanum4" },
    amount: "25000.00",
    source_account: resolvedAccounts.anchor_ops,
    destination_account: resolvedAccounts.muxed_customer_a,
    memo: { type: "text", value: "TR:BENEFICIARY:US:ALICE" },
    sep8_approval: {
      tx_hash: "a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
      status: "approved",
      regulated_asset: "USDC",
      checked_at: "2026-06-15T08:29:55Z",
      sanctions_check: true,
      travel_rule_check: true,
      amount_threshold_check: true,
    },
    travel_rule: {
      originator: "ExampleAnchor Inc.",
      beneficiary: "Alice Johnson",
      originator_vasp: "exampleanchor.com",
      beneficiary_vasp: "exampleanchor.com",
    },
    compliance_flags: ["TRAVEL_RULE_COMPLETE", "SEP8_APPROVED", "KYC_VERIFIED"],
  },
  {
    event_id: "evt-stl-002",
    event_type: "PATH_PAYMENT",
    tx_hash: "b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5",
    ledger: 52_400_250,
    timestamp: "2026-06-15T10:15:00Z",
    asset: { code: "EURC", issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP", type: "credit_alphanum4" },
    amount: "15000.00",
    source_account: resolvedAccounts.muxed_customer_b,
    destination_account: resolvedAccounts.memo_customer,
    memo: { type: "id", value: "42" },
    sep8_approval: {
      tx_hash: "b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5",
      status: "approved",
      regulated_asset: "EURC",
      checked_at: "2026-06-15T10:14:50Z",
      sanctions_check: true,
      travel_rule_check: true,
      amount_threshold_check: true,
    },
    travel_rule: {
      originator: "Customer B",
      beneficiary: "Customer Memo-42",
      originator_vasp: "exampleanchor.com",
      beneficiary_vasp: "exampleanchor.com",
    },
    compliance_flags: ["TRAVEL_RULE_COMPLETE", "SEP8_APPROVED", "MUXED_RESOLVED"],
  },
  {
    event_id: "evt-stl-003",
    event_type: "PAYMENT",
    tx_hash: "c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    ledger: 52_400_500,
    timestamp: "2026-06-15T14:45:00Z",
    asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", type: "credit_alphanum4" },
    amount: "50000.00",
    source_account: resolvedAccounts.muxed_customer_a,
    destination_account: resolvedAccounts.external_exchange,
    memo: { type: "text", value: "withdrawal" },
    sep8_approval: {
      tx_hash: "c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
      status: "revised",
      reason: "Amount exceeds $10,000 threshold — enhanced due diligence required",
      action_required: "Additional KYC documentation submitted and verified",
      regulated_asset: "USDC",
      checked_at: "2026-06-15T14:44:30Z",
      sanctions_check: true,
      travel_rule_check: true,
      amount_threshold_check: false,
    },
    travel_rule: {
      originator: "Alice Johnson",
      beneficiary: "External Exchange",
      originator_vasp: "exampleanchor.com",
      beneficiary_vasp: "unknown",
    },
    compliance_flags: ["TRAVEL_RULE_PARTIAL", "SEP8_REVISED", "HIGH_VALUE", "EDD_REQUIRED"],
  },
  {
    event_id: "evt-stl-004",
    event_type: "PAYMENT",
    tx_hash: "d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7",
    ledger: 52_400_710,
    timestamp: "2026-06-15T18:20:00Z",
    asset: { code: "XLM", type: "native" },
    amount: "500000.00",
    source_account: resolvedAccounts.sanctioned_entity,
    destination_account: resolvedAccounts.anchor_ops,
    memo: { type: "none" },
    sep8_approval: {
      tx_hash: "d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7",
      status: "rejected",
      reason: "Source account GSANC...BLK1 matched OFAC sanctions list — transaction blocked pre-settlement",
      regulated_asset: "XLM",
      checked_at: "2026-06-15T18:19:45Z",
      sanctions_check: false,
      travel_rule_check: false,
      amount_threshold_check: false,
    },
    compliance_flags: ["SANCTIONS_HIT", "SEP8_REJECTED", "BLOCKED_PRE_SETTLEMENT"],
  },
  {
    event_id: "evt-stl-005",
    event_type: "PAYMENT",
    tx_hash: "e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
    ledger: 52_401_020,
    timestamp: "2026-06-16T09:00:00Z",
    asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", type: "credit_alphanum4" },
    amount: "8500.00",
    source_account: resolvedAccounts.anchor_ops,
    destination_account: resolvedAccounts.muxed_customer_b,
    memo: { type: "text", value: "TR:BENEFICIARY:DE:CUSTOMER_B" },
    sep8_approval: {
      tx_hash: "e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
      status: "approved",
      regulated_asset: "USDC",
      checked_at: "2026-06-16T08:59:50Z",
      sanctions_check: true,
      travel_rule_check: true,
      amount_threshold_check: true,
    },
    travel_rule: {
      originator: "ExampleAnchor Inc.",
      beneficiary: "Customer B",
      originator_vasp: "exampleanchor.com",
      beneficiary_vasp: "exampleanchor.com",
    },
    compliance_flags: ["TRAVEL_RULE_COMPLETE", "SEP8_APPROVED", "KYC_VERIFIED"],
  },
  {
    event_id: "evt-stl-006",
    event_type: "FEE",
    tx_hash: "e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
    ledger: 52_401_020,
    timestamp: "2026-06-16T09:00:00Z",
    asset: { code: "XLM", type: "native" },
    amount: "0.00100",
    source_account: resolvedAccounts.anchor_ops,
    destination_account: resolvedAccounts.anchor_ops,
    compliance_flags: [],
  },
];

const mockSep10Sessions: Sep10Auth[] = [
  {
    account: resolvedAccounts.muxed_customer_a.g_address,
    memo: undefined,
    home_domain: "exampleanchor.com",
    web_auth_endpoint: "https://exampleanchor.com/auth",
    challenge_tx: "AAAAAgAAAABCR0...challenge_base64...AAAA",
    signed_at: "2026-06-15T08:25:00Z",
    verified: true,
    client_domain: "wallet.example.org",
  },
  {
    account: resolvedAccounts.memo_customer.g_address,
    memo: "42",
    memo_type: "id",
    home_domain: "exampleanchor.com",
    web_auth_endpoint: "https://exampleanchor.com/auth",
    challenge_tx: "AAAAAgAAAABDQ1...challenge_base64...BBBB",
    signed_at: "2026-06-15T10:10:00Z",
    verified: true,
  },
  {
    account: resolvedAccounts.external_exchange.g_address,
    home_domain: "exampleanchor.com",
    web_auth_endpoint: "https://exampleanchor.com/auth",
    challenge_tx: "AAAAAgAAAABEX0...challenge_base64...CCCC",
    signed_at: "2026-06-15T14:40:00Z",
    verified: true,
  },
];

const mockSep12Submissions: Sep12KycSubmission[] = [
  {
    id: "kyc-001",
    account: resolvedAccounts.muxed_customer_a.g_address,
    memo: undefined,
    type: "individual",
    status: "approved",
    fields_provided: [
      { field_name: "first_name", description: "First name", value: "Alice", status: "accepted" },
      { field_name: "last_name", description: "Last name", value: "Johnson", status: "accepted" },
      { field_name: "email_address", description: "Email", value: "alice@example.com", status: "accepted" },
      { field_name: "address_country_code", description: "Country", value: "US", status: "accepted" },
      { field_name: "id_type", description: "ID Type", value: "passport", status: "accepted" },
      { field_name: "id_number", description: "ID Number", value: "***REDACTED***", status: "accepted" },
      { field_name: "photo_id_front", description: "Photo ID Front", value: "[uploaded]", status: "accepted" },
    ],
    submitted_at: "2026-06-14T16:00:00Z",
    updated_at: "2026-06-14T18:30:00Z",
    kyc_level: "enhanced",
  },
  {
    id: "kyc-002",
    account: resolvedAccounts.muxed_customer_b.g_address,
    memo: undefined,
    type: "individual",
    status: "approved",
    fields_provided: [
      { field_name: "first_name", description: "First name", value: "Bob", status: "accepted" },
      { field_name: "last_name", description: "Last name", value: "Mueller", status: "accepted" },
      { field_name: "email_address", description: "Email", value: "bob@example.de", status: "accepted" },
      { field_name: "address_country_code", description: "Country", value: "DE", status: "accepted" },
      { field_name: "id_type", description: "ID Type", value: "national_id", status: "accepted" },
    ],
    submitted_at: "2026-06-14T17:00:00Z",
    updated_at: "2026-06-14T19:00:00Z",
    kyc_level: "standard",
  },
  {
    id: "kyc-003",
    account: resolvedAccounts.memo_customer.g_address,
    memo: "42",
    memo_type: "id",
    type: "individual",
    status: "pending",
    fields_provided: [
      { field_name: "first_name", description: "First name", value: "Carlos", status: "accepted" },
      { field_name: "last_name", description: "Last name", value: "Reyes", status: "accepted" },
      { field_name: "email_address", description: "Email", value: "carlos@example.mx", status: "accepted" },
      { field_name: "address_country_code", description: "Country", value: "MX", status: "pending" },
      { field_name: "photo_id_front", description: "Photo ID Front", value: "[awaiting]", status: "needs_info" },
    ],
    submitted_at: "2026-06-15T09:00:00Z",
    updated_at: "2026-06-15T09:00:00Z",
    kyc_level: "basic",
  },
];

const mockSep8Approvals: Sep8Approval[] = mockEvents
  .filter((e) => e.sep8_approval)
  .map((e) => e.sep8_approval!);

export const STELLAR_DEMO_RESPONSE: StellarDemoResponse = {
  case_id: STELLAR_DEMO_CASE_ID,
  mode: "compliance",
  report: {
    manifest_version: "2.0.0",
    chain: "STELLAR",
    network: "MAINNET",
    generated_at: "2026-06-16T12:00:00Z",
    total_events: mockEvents.length,
    summary: {
      audit_start: "2026-06-15T08:30:00Z",
      audit_end: "2026-06-16T09:00:00Z",
      total_payments: 5,
      total_volume_usd: "98,500.00",
      unique_assets: ["USDC", "EURC", "XLM"],
      unique_accounts: 6,
      kyc_coverage: "83%",
      sanctions_hits: 1,
      sep8_rejections: 1,
      event_type_counts: { payment: 4, path_payment: 1, fee: 1 },
    },
    events: mockEvents,
    sep10_sessions: mockSep10Sessions,
    sep12_submissions: mockSep12Submissions,
    sep8_approvals: mockSep8Approvals,
    signature: {
      algorithm: "ed25519",
      public_key_hex: "e0b3c1a2d4f5e6b7c8d9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1",
      signature_hex:
        "f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1",
      signed_at: "2026-06-16T12:00:00Z",
    },
  },
};

export const STELLAR_KYT_RESPONSE: StellarDemoResponse = {
  case_id: STELLAR_DEMO_CASE_ID,
  mode: "kyt",
  report: {
    ...STELLAR_DEMO_RESPONSE.report,
    generated_at: "2026-06-16T12:05:00Z",
  },
};

export const SEP_PROTOCOLS: { id: SepProtocol; label: string; description: string }[] = [
  {
    id: "SEP-10",
    label: "Authentication",
    description:
      "Stellar Web Authentication — cryptographic challenge-response that proves account ownership without exposing secret keys. Every session starts here.",
  },
  {
    id: "SEP-12",
    label: "KYC Submission",
    description:
      "Customer data submission and verification via the KYC API. Supports individual and organization types with multi-level verification (basic → enhanced).",
  },
  {
    id: "SEP-9",
    label: "Standard Fields",
    description:
      "Standardised KYC/KYB field definitions — first_name, last_name, id_type, photo_id_front, etc. Ensures interoperability between Anchors, wallets, and compliance providers.",
  },
  {
    id: "SEP-8",
    label: "Regulated Assets",
    description:
      "Pre-settlement transaction approval for regulated assets. Non-compliant transactions are blocked before they hit the ledger — not flagged after the fact.",
  },
];

export const ACCOUNT_FORM_LABELS: Record<AccountForm, { label: string; description: string }> = {
  G_address: {
    label: "G... Address",
    description: "Standard Stellar public key. Maps 1:1 to a single customer record.",
  },
  M_muxed: {
    label: "M... Muxed Account",
    description:
      "Multiplexed account — encodes a parent G... address + sub-account ID. Hera resolves these to individual customer records where competing platforms collapse them into one.",
  },
  G_memo: {
    label: "G... + Memo",
    description:
      "Classic exchange-style addressing. Hera pairs the G... address with the memo field to correctly identify the individual customer.",
  },
};
