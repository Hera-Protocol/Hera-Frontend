import type { ApiErrorBody } from "@hera/core";
import {
  HeraAuthError,
  HeraConnectionError,
  HeraError,
  type HeraErrorInit,
  HeraRateLimitError,
  HeraValidationError,
} from "./errors";
import { SDK_VERSION } from "./version";

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Per-call overrides, accepted as the last argument of every resource method. */
export interface RequestOptions {
  /** Abort the call (and any pending retry). */
  signal?: AbortSignal;
  /** Overrides the client's `timeoutMs` for this call. */
  timeoutMs?: number;
  /** Overrides the client's `maxRetries` for this call. */
  maxRetries?: number;
}

export interface TransportConfig {
  apiKey: string;
  baseUrl: string;
  fetch: FetchFn;
  timeoutMs: number;
  maxRetries: number;
  userAgent?: string;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Expect = "json" | "bytes" | "none";

export interface RequestSpec {
  method: Method;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  expect?: Expect;
  accept?: string;
}

/** Backoff: 0.5 s, 1 s, 2 s … capped at 8 s, with ±50 % jitter. */
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;
/** A Retry-After longer than this is surfaced to the caller instead of slept on. */
const MAX_RETRY_AFTER_MS = 60_000;

const IDEMPOTENT = new Set<Method>(["GET", "DELETE"]);

class TimeoutSignal extends Error {}

/** A response whose body has been read inside the timeout window. */
interface RawResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  text?: string;
  bytes?: Uint8Array<ArrayBuffer>;
}

export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.round(exp / 2 + random() * (exp / 2));
}

/** Seconds or an HTTP date → milliseconds from now. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortReason(signal));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal!));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new HeraConnectionError({ code: "aborted", message: "The request was aborted." });
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object") return false;
  const error = (value as { error?: unknown }).error;
  return !!error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string";
}

export function errorFromResponse(status: number, body: unknown, headers: Headers): HeraError {
  const requestId = headers.get("x-request-id") ?? undefined;
  const parsed = isErrorBody(body) ? body.error : undefined;
  const init: HeraErrorInit = {
    status,
    code: parsed?.code ?? (status >= 500 ? "internal_error" : `http_${status}`),
    message: parsed?.message ?? `Hera API responded with HTTP ${status}.`,
    fields: parsed?.fields,
    requestId,
  };
  if (status === 401 || status === 403) return new HeraAuthError(init);
  if (status === 422) return new HeraValidationError(init);
  if (status === 429) {
    const ms = parseRetryAfter(headers.get("retry-after"));
    return new HeraRateLimitError({ ...init, retryAfter: ms === undefined ? undefined : Math.ceil(ms / 1000) });
  }
  return new HeraError(init);
}

export class Transport {
  /** ECMAScript-private so the key never shows up in JSON.stringify, inspect or Object.entries. */
  readonly #config: TransportConfig;

  constructor(config: TransportConfig) {
    this.#config = config;
  }

  private get config(): TransportConfig {
    return this.#config;
  }

  toJSON(): Record<string, unknown> {
    return { baseUrl: this.#config.baseUrl };
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  url(path: string, query?: RequestSpec["query"]): string {
    let url = `${this.config.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }
    return url;
  }

  async request<T>(spec: RequestSpec, options: RequestOptions = {}): Promise<T> {
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    const idempotent = IDEMPOTENT.has(spec.method);

    for (let attempt = 0; ; attempt++) {
      let response: RawResponse;
      try {
        response = await this.once(spec, options);
      } catch (error) {
        if (options.signal?.aborted) throw abortReason(options.signal);
        const timedOut = error instanceof TimeoutSignal;
        // A timed-out POST may already have been processed, so only idempotent calls retry it.
        const retryable = timedOut ? idempotent : true;
        if (retryable && attempt < maxRetries) {
          await sleep(backoffDelay(attempt), options.signal);
          continue;
        }
        throw new HeraConnectionError({
          code: timedOut ? "timeout" : "connection_error",
          message: timedOut
            ? `No response from Hera within ${options.timeoutMs ?? this.config.timeoutMs} ms.`
            : `Could not reach Hera at ${this.config.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
          cause: timedOut ? undefined : error,
        });
      }

      if (response.ok) return this.read<T>(response, spec.expect ?? "json");

      const status = response.status;
      const retryable = status === 429 || (idempotent && (status >= 500 || status === 408));
      if (retryable && attempt < maxRetries) {
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        if (retryAfter === undefined || retryAfter <= MAX_RETRY_AFTER_MS) {
          await sleep(retryAfter ?? backoffDelay(attempt), options.signal);
          continue;
        }
      }
      throw errorFromResponse(status, parseJsonSafe(response.text), response.headers);
    }
  }

  private async once(spec: RequestSpec, options: RequestOptions): Promise<RawResponse> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener("abort", onAbort, { once: true });

    const headers: Record<string, string> = {
      authorization: `Bearer ${this.config.apiKey}`,
      accept: spec.accept ?? "application/json",
      "user-agent": `hera-sdk-js/${SDK_VERSION}${this.config.userAgent ? ` ${this.config.userAgent}` : ""}`,
    };
    let body: string | undefined;
    if (spec.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(spec.body);
    }

    try {
      const response = await this.config.fetch(this.url(spec.path, spec.query), {
        method: spec.method,
        headers,
        body,
        signal: controller.signal,
      });
      // Read the body while the timeout still applies; a stalled body is still a timeout.
      const raw: RawResponse = { status: response.status, ok: response.ok, headers: response.headers };
      if (spec.expect === "bytes" && response.ok) raw.bytes = new Uint8Array(await response.arrayBuffer());
      else raw.text = await response.text();
      return raw;
    } catch (error) {
      if (timedOut) throw new TimeoutSignal();
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }

  private read<T>(response: RawResponse, expect: Expect): T {
    if (expect === "none" || response.status === 204) return undefined as T;
    if (expect === "bytes") return (response.bytes ?? new TextEncoder().encode(response.text ?? "")) as T;
    if (!response.text) return undefined as T;
    try {
      return JSON.parse(response.text) as T;
    } catch {
      throw new HeraError({
        status: response.status,
        code: "invalid_response",
        message: "Hera returned a response that isn't JSON.",
        requestId: response.headers.get("x-request-id") ?? undefined,
      });
    }
  }
}

function parseJsonSafe(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
