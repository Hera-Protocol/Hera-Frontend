/**
 * Demo sandbox mock data — matches the backend /v1/demo/cases/:id/report contract.
 * Used by the /demo page to simulate the full audit flow for clients/investors.
 */

export interface DemoReportEvent {
  event_id: string;
  event_type: "RECEIVE" | "SEND" | "SHIELD" | "UNSHIELD" | "FEE";
  txid: string;
  block_height: number;
  timestamp: string;
  asset: { symbol: string; asset_id: string; decimals: number };
  amount: string;
  counterparty: { visibility: "KNOWN" | "UNKNOWN" | "PARTIAL"; value: string | null };
  memo: { present: boolean; hash: string | null };
  provenance: { source: string; pool: string; scan_version: string };
}

export interface DemoReportSummary {
  audit_start: string;
  audit_end: string;
  total_received: string;
  total_sent: string;
  distinct_assets: string[];
  event_type_counts: Record<string, number>;
}

export interface DemoSignature {
  algorithm: string;
  public_key_hex: string;
  signature_hex: string;
  signed_at: string;
}

export interface DemoReport {
  manifest_version: string;
  chain: string;
  network: string;
  generated_at: string;
  total_events: number;
  summary: DemoReportSummary;
  events: DemoReportEvent[];
  signature: DemoSignature;
}

export interface DemoAttestation {
  attestation_version: string;
  proof_type: string;
  srs_version: string;
  public_inputs: {
    proof_type: string;
    threshold: number;
    event_count: number;
    verified: boolean;
  };
  proof_sha256: string;
  verified: boolean;
  created_at: string;
}

export interface DemoResponse {
  case_id: string;
  mode: "standard" | "zk";
  report: DemoReport;
  attestation?: DemoAttestation;
}

export const DEMO_CASE_ID = "d4e5f6a7-b8c9-0123-4567-89abcdef0123";

const sharedEvents: DemoReportEvent[] = [
  {
    event_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    event_type: "RECEIVE",
    txid: "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16",
    block_height: 2100000,
    timestamp: "2026-05-20T10:30:00Z",
    asset: { symbol: "ZEC", asset_id: "zcash", decimals: 8 },
    amount: "1.50000000",
    counterparty: { visibility: "UNKNOWN", value: null },
    memo: { present: true, hash: "a3f2b1c4d5e6f708a9b0c1d2e3f4a5b6" },
    provenance: { source: "lightwalletd", pool: "sapling", scan_version: "stage2" },
  },
  {
    event_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    event_type: "RECEIVE",
    txid: "8a3c51e2a1f9b4d7c0e6f3a28b5d1c9e4f7a0b3d6e9c2f5a8b1d4e7c0f3a6b9",
    block_height: 2100142,
    timestamp: "2026-05-20T14:22:00Z",
    asset: { symbol: "ZEC", asset_id: "zcash", decimals: 8 },
    amount: "3.25000000",
    counterparty: { visibility: "UNKNOWN", value: null },
    memo: { present: false, hash: null },
    provenance: { source: "lightwalletd", pool: "sapling", scan_version: "stage2" },
  },
  {
    event_id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    event_type: "SEND",
    txid: "1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    block_height: 2100501,
    timestamp: "2026-05-21T09:15:00Z",
    asset: { symbol: "ZEC", asset_id: "zcash", decimals: 8 },
    amount: "0.75000000",
    counterparty: { visibility: "PARTIAL", value: "t1Kx...9f2a" },
    memo: { present: true, hash: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9" },
    provenance: { source: "lightwalletd", pool: "sapling", scan_version: "stage2" },
  },
  {
    event_id: "d4e5f6a7-b8c9-0123-defg-234567890123",
    event_type: "FEE",
    txid: "1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    block_height: 2100501,
    timestamp: "2026-05-21T09:15:00Z",
    asset: { symbol: "ZEC", asset_id: "zcash", decimals: 8 },
    amount: "0.00010000",
    counterparty: { visibility: "UNKNOWN", value: null },
    memo: { present: false, hash: null },
    provenance: { source: "lightwalletd", pool: "sapling", scan_version: "stage2" },
  },
];

const sharedReport: DemoReport = {
  manifest_version: "1.0.0",
  chain: "ZCASH",
  network: "MAINNET",
  generated_at: "2026-05-28T12:00:00Z",
  total_events: 4,
  summary: {
    audit_start: "2026-05-20T10:30:00Z",
    audit_end: "2026-05-22T09:45:00Z",
    total_received: "4.75000000",
    total_sent: "0.75000000",
    distinct_assets: ["ZEC"],
    event_type_counts: { shield: 0, receive: 2, send: 1, unshield: 0, fee: 1 },
  },
  events: sharedEvents,
  signature: {
    algorithm: "ed25519",
    public_key_hex: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa3f4a18446b7e8b47a18e7",
    signature_hex:
      "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    signed_at: "2026-05-28T12:00:00Z",
  },
};

export const DEMO_STANDARD_RESPONSE: DemoResponse = {
  case_id: DEMO_CASE_ID,
  mode: "standard",
  report: sharedReport,
};

export const DEMO_ZK_RESPONSE: DemoResponse = {
  case_id: DEMO_CASE_ID,
  mode: "zk",
  report: sharedReport,
  attestation: {
    attestation_version: "1.0.0",
    proof_type: "THRESHOLD_RECEIVED",
    srs_version: "caulk-plus-v1",
    public_inputs: {
      proof_type: "THRESHOLD_RECEIVED",
      threshold: 100000000,
      event_count: 4,
      verified: true,
    },
    proof_sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    verified: true,
    created_at: "2026-05-28T12:01:00Z",
  },
};

export const ZK_PROOF_TYPES = [
  {
    id: "THRESHOLD_RECEIVED",
    label: "Threshold Received",
    description: "Proves total received amount exceeds a threshold without revealing exact amounts.",
  },
  {
    id: "NO_BLOCKLIST_EXPOSURE",
    label: "No Blocklist Exposure",
    description: "Proves no transactions involve blocklisted addresses without revealing counterparties.",
  },
  {
    id: "RISK_BELOW_THRESHOLD",
    label: "Risk Below Threshold",
    description: "Proves aggregate risk score stays below a compliance threshold.",
  },
];
