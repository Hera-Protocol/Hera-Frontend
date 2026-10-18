import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

/**
 * Webhook signatures, shared by the API (signing) and the SDK (verifying).
 *
 *   Hera-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
 *
 * The timestamp is inside the MAC so a captured delivery can't be replayed
 * later; receivers reject signatures outside a tolerance window.
 */

export const WEBHOOK_SIGNATURE_HEADER = "hera-signature";
export const WEBHOOK_EVENT_ID_HEADER = "hera-event-id";
export const WEBHOOK_DEFAULT_TOLERANCE_SECONDS = 300;

const encoder = new TextEncoder();

function mac(secret: string, timestamp: number, payload: string): string {
  return bytesToHex(hmac(sha256, encoder.encode(secret), encoder.encode(`${timestamp}.${payload}`)));
}

export function signWebhookPayload(secret: string, payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${mac(secret, timestamp, payload)}`;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type WebhookVerifyResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: "malformed" | "expired" | "mismatch" };

export function verifyWebhookSignature(input: {
  payload: string;
  header: string | null | undefined;
  secret: string;
  toleranceSeconds?: number;
  now?: number;
}): WebhookVerifyResult {
  if (!input.header) return { ok: false, reason: "malformed" };

  const parts = Object.fromEntries(
    input.header.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isInteger(timestamp) || !signature || !/^[0-9a-f]{64}$/.test(signature)) {
    return { ok: false, reason: "malformed" };
  }

  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > (input.toleranceSeconds ?? WEBHOOK_DEFAULT_TOLERANCE_SECONDS)) {
    return { ok: false, reason: "expired" };
  }

  return timingSafeEqualHex(mac(input.secret, timestamp, input.payload), signature)
    ? { ok: true, timestamp }
    : { ok: false, reason: "mismatch" };
}
