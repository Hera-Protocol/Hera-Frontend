import {
  type AlertDto,
  type ReportDto,
  type ScreeningSummaryDto,
  type TravelRuleTransferDto,
  verifyWebhookSignature,
  type WalletDto,
  WEBHOOK_DEFAULT_TOLERANCE_SECONDS,
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  type WebhookEventType,
} from "@hera/core";
import { HeraWebhookSignatureError } from "./errors";

/** Lower-case header names, as Node's `req.headers` and `Headers#get` use them. */
export const HERA_SIGNATURE_HEADER = WEBHOOK_SIGNATURE_HEADER;
export const HERA_EVENT_ID_HEADER = WEBHOOK_EVENT_ID_HEADER;
export const HERA_WEBHOOK_TOLERANCE_SECONDS = WEBHOOK_DEFAULT_TOLERANCE_SECONDS;

/** The `data` type for each event. */
export interface WebhookEventDataMap {
  "screening.completed": ScreeningSummaryDto;
  "alert.created": AlertDto;
  "alert.updated": AlertDto;
  "wallet.activity": { wallet: WalletDto; newTransfers: number };
  "travel_rule.updated": TravelRuleTransferDto;
  "report.ready": ReportDto;
}

/** A verified webhook delivery. Switch on `type` and `data` narrows with it. */
export type HeraWebhookEvent = {
  [K in WebhookEventType]: { id: string; type: K; createdAt: string; orgId: string; data: WebhookEventDataMap[K] };
}[WebhookEventType];

export type HeraWebhookEventOf<K extends WebhookEventType> = Extract<HeraWebhookEvent, { type: K }>;

export interface ConstructEventOptions {
  /** Maximum age of the signature timestamp. Default 300 s. */
  toleranceSeconds?: number;
  /** Unix seconds; for tests. */
  now?: number;
}

const decoder = new TextDecoder();

const REASON_MESSAGES = {
  malformed: `The ${HERA_SIGNATURE_HEADER} header is missing or malformed.`,
  expired: "The signature timestamp is outside the tolerance window. Check the server clock, or this is a replay.",
  mismatch: "The signature doesn't match. Check the endpoint's signing secret, and verify the raw request body, not re-serialized JSON.",
} as const;

/**
 * Verify a webhook delivery and return the typed event.
 *
 * Pass the body exactly as received (a string or bytes). Parsing JSON and
 * re-serializing it changes whitespace and key order, and the signature will
 * no longer match.
 *
 * Throws `HeraWebhookSignatureError` when the request isn't from Hera.
 */
export function constructEvent(
  rawBody: string | Uint8Array,
  signatureHeader: string | string[] | null | undefined,
  secret: string,
  options: ConstructEventOptions = {},
): HeraWebhookEvent {
  if (typeof rawBody !== "string" && !(rawBody instanceof Uint8Array)) {
    throw new HeraWebhookSignatureError(
      "raw_body_required",
      "constructEvent needs the raw request body as a string or Uint8Array. Disable JSON body parsing for the webhook route.",
    );
  }
  if (!secret) throw new HeraWebhookSignatureError("mismatch", "No webhook signing secret was provided.");

  const payload = typeof rawBody === "string" ? rawBody : decoder.decode(rawBody);
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  const result = verifyWebhookSignature({
    payload,
    header,
    secret,
    toleranceSeconds: options.toleranceSeconds ?? HERA_WEBHOOK_TOLERANCE_SECONDS,
    now: options.now,
  });
  if (!result.ok) throw new HeraWebhookSignatureError(result.reason, REASON_MESSAGES[result.reason]);

  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    throw new HeraWebhookSignatureError("invalid_payload", "The signature is valid but the body isn't JSON.");
  }
  if (
    !event ||
    typeof event !== "object" ||
    typeof (event as { id?: unknown }).id !== "string" ||
    typeof (event as { type?: unknown }).type !== "string" ||
    typeof (event as { data?: unknown }).data !== "object"
  ) {
    throw new HeraWebhookSignatureError("invalid_payload", "The signature is valid but the body isn't a Hera event.");
  }
  // Event types added after this SDK version still verify; handle them in your switch's default branch.
  return event as HeraWebhookEvent;
}

export const webhooks = {
  constructEvent,
  SIGNATURE_HEADER: HERA_SIGNATURE_HEADER,
  EVENT_ID_HEADER: HERA_EVENT_ID_HEADER,
  DEFAULT_TOLERANCE_SECONDS: HERA_WEBHOOK_TOLERANCE_SECONDS,
} as const;
