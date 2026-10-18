import type { Decision, ScreeningResponse } from "@hera/core";

export interface HeraErrorInit {
  status?: number;
  code: string;
  message: string;
  fields?: Record<string, string>;
  requestId?: string;
  cause?: unknown;
}

/**
 * Base class for everything the SDK throws. API errors carry the HTTP status
 * and the `{ error: { code, message, fields? } }` body from the contract.
 */
export class HeraError extends Error {
  override readonly name: string = "HeraError";
  /** HTTP status, when the error came from a response. */
  readonly status?: number;
  /** Machine-readable code, e.g. `validation_failed`, `forbidden`, `rate_limited`. */
  readonly code: string;
  /** Field path → message, for validation errors. */
  readonly fields?: Record<string, string>;
  /** `x-request-id` from the response, when the API sent one. Quote it to support. */
  readonly requestId?: string;

  constructor(init: HeraErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields;
    this.requestId = init.requestId;
  }
}

/** 401 (missing, invalid or revoked key) or 403 (key lacks the scope, or the endpoint is dashboard-only). */
export class HeraAuthError extends HeraError {
  override readonly name = "HeraAuthError";
}

/** 422, or the same check run locally before any network call. */
export class HeraValidationError extends HeraError {
  override readonly name = "HeraValidationError";
}

/** 429. `retryAfter` is in seconds, when the API said how long to wait. */
export class HeraRateLimitError extends HeraError {
  override readonly name = "HeraRateLimitError";
  readonly retryAfter?: number;

  constructor(init: HeraErrorInit & { retryAfter?: number }) {
    super(init);
    this.retryAfter = init.retryAfter;
  }
}

/** Network failure or timeout: no usable response arrived. */
export class HeraConnectionError extends HeraError {
  override readonly name = "HeraConnectionError";
}

/** Thrown by `hera.guard()` when the decision is one you chose to block. */
export class HeraBlockedError extends HeraError {
  override readonly name = "HeraBlockedError";
  readonly decision: Decision;
  readonly screening: ScreeningResponse;

  constructor(screening: ScreeningResponse) {
    const top = [...screening.reasons].sort((a, b) => b.points - a.points)[0];
    super({
      code: "blocked",
      message: `Hera ${screening.decision === "block" ? "blocked" : "flagged"} ${screening.display} (score ${screening.score}, ${screening.band})${top ? `: ${top.title}` : ""}.`,
    });
    this.decision = screening.decision;
    this.screening = screening;
  }
}

export type WebhookSignatureFailure = "malformed" | "expired" | "mismatch" | "invalid_payload" | "raw_body_required";

/** `Hera.webhooks.constructEvent` could not prove the request came from Hera. Respond 400. */
export class HeraWebhookSignatureError extends HeraError {
  override readonly name = "HeraWebhookSignatureError";
  readonly reason: WebhookSignatureFailure;

  constructor(reason: WebhookSignatureFailure, message: string) {
    super({ code: `webhook_signature_${reason}`, message });
    this.reason = reason;
  }
}
