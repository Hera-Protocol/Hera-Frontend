import { createHash } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

/** JSON with object keys sorted at every depth, so the same event always hashes the same way. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export interface HashedFields {
  seq: number;
  actor: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function auditHash(prevHash: string, fields: HashedFields): string {
  return createHash("sha256").update(prevHash + canonicalJson(fields)).digest("hex");
}
