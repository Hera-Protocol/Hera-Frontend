import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

/** `whsec_<32 random bytes, base64url>`. Receivers HMAC with the whole string. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

/** First 12 characters, e.g. `whsec_Ab12Cd`: enough to recognise, useless to forge. */
export const secretPrefixOf = (secret: string) => secret.slice(0, 12);

/**
 * AES-256-GCM with a random 96-bit IV. The endpoint id is bound in as
 * associated data, so a ciphertext copied onto another endpoint won't open.
 */
export function sealSecret(key: Buffer, secret: string, endpointId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(endpointId));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

export function openSecret(key: Buffer, sealed: string, endpointId: string): string {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) throw new Error("Unrecognised webhook secret format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(endpointId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
