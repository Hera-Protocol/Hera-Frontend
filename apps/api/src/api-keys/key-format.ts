import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "hera_live_";
const PREFIX_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const PREFIX_LENGTH = 8;

export interface GeneratedKey {
  prefix: string;
  secret: string;
  /** The full key handed to the user once: `hera_live_<prefix>_<secret>`. */
  key: string;
}

export function generateKey(): GeneratedKey {
  const prefix = Array.from({ length: PREFIX_LENGTH }, () => PREFIX_ALPHABET[randomInt(PREFIX_ALPHABET.length)]).join("");
  const secret = randomBytes(32).toString("base64url");
  return { prefix, secret, key: `${KEY_PREFIX}${prefix}_${secret}` };
}

/** Split a presented key. The secret is base64url and may itself contain `_`, so split only once. */
export function parseKey(key: string): { prefix: string; secret: string } | null {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const rest = key.slice(KEY_PREFIX.length);
  const prefix = rest.slice(0, PREFIX_LENGTH);
  if (rest[PREFIX_LENGTH] !== "_") return null;
  const secret = rest.slice(PREFIX_LENGTH + 1);
  if (!/^[a-z0-9]+$/.test(prefix) || !/^[A-Za-z0-9_-]{20,}$/.test(secret)) return null;
  return { prefix, secret };
}

export const displayPrefix = (prefix: string) => `${KEY_PREFIX}${prefix}`;

export function hashSecret(pepper: string, secret: string): string {
  return createHmac("sha256", pepper).update(secret).digest("hex");
}

export function secretMatches(pepper: string, secret: string, storedHash: string): boolean {
  const actual = Buffer.from(hashSecret(pepper, secret), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
