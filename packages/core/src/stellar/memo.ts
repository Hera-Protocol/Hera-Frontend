import type { StellarSubAccount, Transfer } from "../types";

/**
 * Stellar memos. Horizon reports `memo_type` as none, text, id, hash or return,
 * and serves hash and return memos (32 raw bytes) base64-encoded. People write
 * them as hex. Hera normalizes them to lowercase hex at ingest, and matching
 * accepts either encoding so data normalized by an older engine still matches.
 */

const HEX_32 = /^[0-9a-fA-F]{64}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Decode base64 to lowercase hex; null when the input is not base64. */
export function base64ToHex(value: string): string | null {
  if (!BASE64.test(value) || value.length % 4 !== 0) return null;
  try {
    const binary = atob(value);
    let hex = "";
    for (let i = 0; i < binary.length; i++) hex += binary.charCodeAt(i).toString(16).padStart(2, "0");
    return hex;
  } catch {
    return null;
  }
}

/** A 32-byte memo as lowercase hex, from hex or base64 input; null if it is neither. */
export function memoBytesHex(value: string): string | null {
  if (HEX_32.test(value)) return value.toLowerCase();
  const hex = base64ToHex(value);
  return hex && hex.length === 64 ? hex : null;
}

/** Normalize a Horizon memo for storage on a Transfer. */
export function normalizeMemo(type: string | undefined, value: string | undefined): Transfer["memo"] {
  if (!type || type === "none" || value === undefined) return undefined;
  if (type === "hash" || type === "return") return { type, value: memoBytesHex(value) ?? value };
  return { type, value };
}

function canonicalId(value: string): string | null {
  return /^\d+$/.test(value) ? BigInt(value).toString() : null;
}

/**
 * Whether a transfer's memo identifies this memo sub-account.
 * A `hash` subject matches both hash and return memos: both are 32 bytes, and
 * whoever typed the hex rarely knows which memo type the sender chose.
 */
export function memoMatches(sub: Extract<StellarSubAccount, { kind: "memo" }>, memo: Transfer["memo"]): boolean {
  if (!memo) return false;
  switch (sub.type) {
    case "id": {
      if (memo.type !== "id") return false;
      const want = canonicalId(sub.value.trim());
      return want !== null && canonicalId(memo.value) === want;
    }
    case "text":
      return memo.type === "text" && memo.value === sub.value;
    case "hash": {
      if (memo.type !== "hash" && memo.type !== "return") return false;
      const want = memoBytesHex(sub.value.trim());
      return want !== null && memoBytesHex(memo.value) === want;
    }
  }
}
