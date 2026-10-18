import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, base64url. Used for session and password-reset tokens. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are stored only as their SHA-256, so a database leak can't be replayed. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
