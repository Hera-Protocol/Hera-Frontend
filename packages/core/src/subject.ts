import { checkEvmAddress } from "./evm/address";
import { CHAINS } from "./chains";
import { decodeMuxedAccount, encodeMuxedAccount, isValidAccountId } from "./stellar/strkey";
import type { ChainId, StellarSubAccount, SubjectRef } from "./types";

export interface ParseSubjectInput {
  address: string;
  /** Required to disambiguate EVM chains. Ignored for Stellar addresses. */
  chain?: ChainId;
  memo?: { type: "id" | "text" | "hash"; value: string };
}

export type ParseSubjectResult =
  | { ok: true; subject: SubjectRef }
  | { ok: false; error: string };

const MAX_UINT64 = (1n << 64n) - 1n;

function validateMemo(memo: NonNullable<ParseSubjectInput["memo"]>): string | null {
  const value = memo.value.trim();
  if (!value) return null;
  switch (memo.type) {
    case "id":
      if (!/^\d+$/.test(value) || BigInt(value) > MAX_UINT64) return "Memo ID must be an unsigned 64-bit integer.";
      return null;
    case "text":
      if (new TextEncoder().encode(value).length > 28) return "Memo text is limited to 28 bytes.";
      return null;
    case "hash":
      if (!/^[0-9a-fA-F]{64}$/.test(value)) return "Memo hash must be 32 bytes of hex.";
      return null;
  }
}

/** One spelling per memo, so equal memos get equal subject keys: no leading zeros, lowercase hex. */
function canonicalMemoValue(type: "id" | "text" | "hash", value: string): string {
  if (type === "id") return BigInt(value).toString();
  if (type === "hash") return value.toLowerCase();
  return value;
}

/**
 * Turn user or API input into a structured SubjectRef.
 * Muxed `M…` addresses are decoded here, at the edge, so nothing downstream
 * ever sees a muxed strkey as if it were an ordinary account.
 */
export function parseSubject(input: ParseSubjectInput): ParseSubjectResult {
  const address = input.address.trim();
  if (!address) return { ok: false, error: "Enter an address." };

  if (address.startsWith("M")) {
    const muxed = decodeMuxedAccount(address);
    if (!muxed) return { ok: false, error: "That M… address has an invalid checksum or length." };
    if (input.memo?.value.trim()) {
      return { ok: false, error: "A muxed address already identifies the sub-account. Remove the memo." };
    }
    return {
      ok: true,
      subject: {
        chain: "stellar",
        account: muxed.account,
        sub: { kind: "muxed", id: muxed.id.toString(), muxed: address },
      },
    };
  }

  if (address.startsWith("G")) {
    if (!isValidAccountId(address)) return { ok: false, error: "That G… address has an invalid checksum or length." };
    let sub: StellarSubAccount | undefined;
    if (input.memo?.value.trim()) {
      const memoError = validateMemo(input.memo);
      if (memoError) return { ok: false, error: memoError };
      sub = { kind: "memo", type: input.memo.type, value: canonicalMemoValue(input.memo.type, input.memo.value.trim()) };
    }
    return { ok: true, subject: { chain: "stellar", account: address, ...(sub ? { sub } : {}) } };
  }

  if (address.startsWith("0x") || address.startsWith("0X")) {
    const normalized = `0x${address.slice(2)}`;
    const check = checkEvmAddress(normalized);
    if (!check.ok) {
      return {
        ok: false,
        error: check.reason === "checksum"
          ? "Checksum mismatch: this address has mixed case that doesn't match EIP-55. Check for a typo."
          : "EVM addresses are 0x followed by 40 hex characters.",
      };
    }
    const chain = input.chain && input.chain !== "stellar" ? input.chain : "evm:1";
    if (!CHAINS[chain]) return { ok: false, error: `Unsupported chain: ${chain}` };
    return { ok: true, subject: { chain: chain as `evm:${number}`, address: check.address } };
  }

  return { ok: false, error: "Paste a Stellar address (G… or M…) or an EVM address (0x…)." };
}

export function shortAddress(address: string, head = 4, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head + (address.startsWith("0x") ? 2 : 0))}…${address.slice(-tail)}`;
}

/** Base address for lookups: the `G…` account or the EVM address. */
export function subjectAddress(subject: SubjectRef): string {
  return subject.chain === "stellar" ? subject.account : subject.address;
}

/** Stable key for caches and database uniqueness. */
export function subjectKey(subject: SubjectRef): string {
  if (subject.chain !== "stellar") return `${subject.chain}:${subject.address.toLowerCase()}`;
  if (!subject.sub) return `stellar:${subject.account}`;
  return subject.sub.kind === "muxed"
    ? `stellar:${subject.account}:muxed:${subject.sub.id}`
    : `stellar:${subject.account}:memo:${subject.sub.type}:${subject.sub.value}`;
}

export function formatSubject(subject: SubjectRef): string {
  if (subject.chain !== "stellar") return subject.address;
  if (!subject.sub) return subject.account;
  return subject.sub.kind === "muxed"
    ? subject.sub.muxed
    : `${subject.account} (memo ${subject.sub.type}: ${subject.sub.value})`;
}

/** Re-derive the M… address for a G… + id pair, e.g. for display after a DB round trip. */
export function muxedFor(account: string, id: string): string {
  return encodeMuxedAccount(account, BigInt(id));
}
