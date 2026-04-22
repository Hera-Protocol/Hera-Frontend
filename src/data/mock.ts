export type CaseStatus = "CREATED" | "SCANNING" | "SIGNED" | "FAILED";
export type Chain = "Zcash" | "Namada";
export type ScanStage = "CREATED" | "KEY_VALIDATED" | "CHAIN_SYNCING" | "DETECTING_NOTES" | "CLASSIFYING_FLOWS" | "BUILDING_REPORT" | "SIGNED";
export type EventType = "RECEIVE" | "SEND" | "SHIELD" | "UNSHIELD";

export interface Case {
  id: string;
  chain: Chain;
  status: CaseStatus;
  created: string;
  network: "Mainnet" | "Testnet";
}

export interface CaseEvent {
  blockHeight: number;
  timestamp: string;
  eventType: EventType;
  asset: string;
  amount: string;
  ownershipProof: "CRYPTOGRAPHIC";
  counterpartyVisibility: "UNKNOWN" | "PARTIAL";
}

export interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  ip: string;
}

export const SCAN_STAGES: ScanStage[] = [
  "CREATED", "KEY_VALIDATED", "CHAIN_SYNCING", "DETECTING_NOTES", "CLASSIFYING_FLOWS", "BUILDING_REPORT", "SIGNED"
];

export const mockCases: Case[] = [
  { id: "CASE-7f3a8b2c", chain: "Zcash", status: "SIGNED", created: "2026-04-14", network: "Mainnet" },
  { id: "CASE-e91d4f0a", chain: "Namada", status: "SCANNING", created: "2026-04-15", network: "Mainnet" },
  { id: "CASE-2c8e5d1b", chain: "Zcash", status: "CREATED", created: "2026-04-16", network: "Testnet" },
  { id: "CASE-a4b7c9e3", chain: "Namada", status: "FAILED", created: "2026-04-13", network: "Mainnet" },
  { id: "CASE-1d6f3a09", chain: "Zcash", status: "SIGNED", created: "2026-04-12", network: "Mainnet" },
  { id: "CASE-9b2e7c41", chain: "Namada", status: "SIGNED", created: "2026-04-11", network: "Mainnet" },
  { id: "CASE-5a8d0fb6", chain: "Zcash", status: "SIGNED", created: "2026-04-10", network: "Mainnet" },
  { id: "CASE-3e7c2a18", chain: "Namada", status: "SIGNED", created: "2026-04-09", network: "Testnet" },
  { id: "CASE-c4f81d33", chain: "Zcash", status: "SIGNED", created: "2026-04-08", network: "Mainnet" },
  { id: "CASE-6b9e4d77", chain: "Namada", status: "SIGNED", created: "2026-04-07", network: "Mainnet" },
];

export const mockEvents: CaseEvent[] = [
  { blockHeight: 2145832, timestamp: "2026-04-14 08:23:41", eventType: "RECEIVE", asset: "ZEC", amount: "12.5000", ownershipProof: "CRYPTOGRAPHIC", counterpartyVisibility: "UNKNOWN" },
  { blockHeight: 2145901, timestamp: "2026-04-14 09:01:12", eventType: "SHIELD", asset: "ZEC", amount: "12.5000", ownershipProof: "CRYPTOGRAPHIC", counterpartyVisibility: "UNKNOWN" },
  { blockHeight: 2146044, timestamp: "2026-04-14 11:44:03", eventType: "SEND", asset: "ZEC", amount: "3.2100", ownershipProof: "CRYPTOGRAPHIC", counterpartyVisibility: "PARTIAL" },
  { blockHeight: 2146199, timestamp: "2026-04-14 14:12:55", eventType: "UNSHIELD", asset: "ZEC", amount: "5.0000", ownershipProof: "CRYPTOGRAPHIC", counterpartyVisibility: "UNKNOWN" },
  { blockHeight: 2146301, timestamp: "2026-04-14 16:30:22", eventType: "SEND", asset: "ZEC", amount: "1.7800", ownershipProof: "CRYPTOGRAPHIC", counterpartyVisibility: "UNKNOWN" },
];

export const mockAuditLog: AuditEntry[] = [
  { timestamp: "2026-04-16 09:14:22", actor: "admin@hera.io", action: "CASE_CREATED", resource: "CASE-2c8e5d1b", ip: "192.168.1.42" },
  { timestamp: "2026-04-15 14:33:01", actor: "analyst@hera.io", action: "SCAN_STARTED", resource: "CASE-e91d4f0a", ip: "10.0.0.15" },
  { timestamp: "2026-04-14 11:22:45", actor: "admin@hera.io", action: "REPORT_DOWNLOADED", resource: "CASE-7f3a8b2c", ip: "192.168.1.42" },
  { timestamp: "2026-04-14 08:01:10", actor: "system", action: "SCAN_COMPLETED", resource: "CASE-7f3a8b2c", ip: "internal" },
  { timestamp: "2026-04-13 17:45:33", actor: "analyst@hera.io", action: "KEY_IMPORTED", resource: "CASE-a4b7c9e3", ip: "10.0.0.15" },
  { timestamp: "2026-04-13 16:20:11", actor: "admin@hera.io", action: "CASE_CREATED", resource: "CASE-a4b7c9e3", ip: "192.168.1.42" },
];

export const REPORT_HASH = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
