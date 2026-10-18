import { randomInt } from "node:crypto";

// Crockford-style: no I, L, O or U, so references survive being read aloud or retyped.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Human-friendly transfer reference, e.g. `TR-7F3K2Q`. */
export function newReference(): string {
  return `TR-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
}
