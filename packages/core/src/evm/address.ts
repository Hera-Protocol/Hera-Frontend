import { keccak_256 } from "@noble/hashes/sha3";

export type EvmAddress = `0x${string}`;

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const encoder = new TextEncoder();

/** EIP-55 mixed-case checksum encoding. */
export function toChecksumAddress(address: string): EvmAddress {
  if (!HEX_ADDRESS.test(address)) throw new Error(`Not an EVM address: ${address}`);

  const lower = address.slice(2).toLowerCase();
  const hash = keccak_256(encoder.encode(lower));
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    const nibble = (hash[i >> 1]! >> (i % 2 === 0 ? 4 : 0)) & 0x0f;
    out += nibble >= 8 ? lower[i]!.toUpperCase() : lower[i];
  }
  return out as EvmAddress;
}

export type EvmAddressCheck =
  | { ok: true; address: EvmAddress }
  | { ok: false; reason: "format" | "checksum" };

/**
 * All-lowercase or all-uppercase input carries no checksum and is accepted.
 * Mixed-case input must match EIP-55 exactly, because a mismatch almost
 * always means a mistyped address.
 */
export function checkEvmAddress(input: string): EvmAddressCheck {
  if (!HEX_ADDRESS.test(input)) return { ok: false, reason: "format" };

  const body = input.slice(2);
  const checksummed = toChecksumAddress(input);
  const hasChecksum = body !== body.toLowerCase() && body !== body.toUpperCase();
  if (hasChecksum && checksummed !== input) return { ok: false, reason: "checksum" };

  return { ok: true, address: checksummed };
}

export function isEvmAddress(input: string): boolean {
  return checkEvmAddress(input).ok;
}
