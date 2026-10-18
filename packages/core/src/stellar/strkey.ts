/**
 * Stellar StrKey codec (SEP-23), including muxed `M…` accounts.
 *
 * A strkey is base32(versionByte ‖ payload ‖ crc16xmodem(versionByte ‖ payload)),
 * with the checksum little-endian and no base32 padding.
 *
 *   G… ed25519 public key   payload = 32-byte key                 (56 chars)
 *   M… muxed account        payload = 32-byte key ‖ uint64 BE id  (69 chars)
 *   C… contract             payload = 32-byte contract id         (56 chars)
 *
 * Self-contained on purpose: the web bundle and the API both need this, and the
 * full Stellar SDK is a heavy dependency for ~100 lines of logic.
 */

const VERSION = {
  ed25519PublicKey: 6 << 3, // 'G'
  muxedAccount: 12 << 3, // 'M'
  contract: 2 << 3, // 'C'
} as const;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ALPHABET_INDEX: Record<string, number> = Object.fromEntries(
  [...ALPHABET].map((char, index) => [char, index]),
);

const MAX_UINT64 = (1n << 64n) - 1n;

export function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0x0000;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** Strict decode: rejects unknown characters and non-canonical trailing bits. */
function base32Decode(input: string): Uint8Array | null {
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of input) {
    const index = ALPHABET_INDEX[char];
    if (index === undefined) return null;
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  // Leftover bits must be zero padding, otherwise two strings decode the same.
  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) return null;
  return Uint8Array.from(out);
}

function encodeCheck(versionByte: number, payload: Uint8Array): string {
  const data = new Uint8Array(1 + payload.length);
  data[0] = versionByte;
  data.set(payload, 1);
  const crc = crc16xmodem(data);
  const full = new Uint8Array(data.length + 2);
  full.set(data);
  full[data.length] = crc & 0xff;
  full[data.length + 1] = crc >>> 8;
  return base32Encode(full);
}

function decodeCheck(versionByte: number, encoded: string, payloadLength: number): Uint8Array | null {
  const expectedChars = Math.ceil(((1 + payloadLength + 2) * 8) / 5);
  if (encoded.length !== expectedChars) return null;

  const bytes = base32Decode(encoded);
  if (!bytes || bytes.length !== 1 + payloadLength + 2) return null;
  if (bytes[0] !== versionByte) return null;

  const data = bytes.subarray(0, bytes.length - 2);
  const crc = crc16xmodem(data);
  const lo = bytes[bytes.length - 2];
  const hi = bytes[bytes.length - 1];
  if (lo !== (crc & 0xff) || hi !== crc >>> 8) return null;

  return bytes.slice(1, 1 + payloadLength);
}

/* ─── Public API ─────────────────────────────────────── */

export function decodeEd25519PublicKey(address: string): Uint8Array | null {
  return decodeCheck(VERSION.ed25519PublicKey, address, 32);
}

export function encodeEd25519PublicKey(key: Uint8Array): string {
  if (key.length !== 32) throw new Error("ed25519 public key must be 32 bytes");
  return encodeCheck(VERSION.ed25519PublicKey, key);
}

export function isValidAccountId(address: string): boolean {
  return decodeEd25519PublicKey(address) !== null;
}

export function isValidContractId(address: string): boolean {
  return decodeCheck(VERSION.contract, address, 32) !== null;
}

export interface MuxedAccount {
  /** The underlying `G…` account that holds the balance on-ledger. */
  account: string;
  /** The SEP-23 sub-account id (uint64). */
  id: bigint;
  /** The original `M…` strkey. */
  muxed: string;
}

export function decodeMuxedAccount(muxed: string): MuxedAccount | null {
  const payload = decodeCheck(VERSION.muxedAccount, muxed, 40);
  if (!payload) return null;

  let id = 0n;
  for (let i = 32; i < 40; i++) id = (id << 8n) | BigInt(payload[i]!);

  return { account: encodeEd25519PublicKey(payload.slice(0, 32)), id, muxed };
}

export function encodeMuxedAccount(account: string, id: bigint | string | number): string {
  const key = decodeEd25519PublicKey(account);
  if (!key) throw new Error(`Not a valid Stellar account id: ${account}`);

  const big = BigInt(id);
  if (big < 0n || big > MAX_UINT64) throw new Error("Muxed id must be a uint64");

  const payload = new Uint8Array(40);
  payload.set(key);
  let rest = big;
  for (let i = 39; i >= 32; i--) {
    payload[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return encodeCheck(VERSION.muxedAccount, payload);
}

export function isValidMuxedAccount(address: string): boolean {
  return decodeMuxedAccount(address) !== null;
}
