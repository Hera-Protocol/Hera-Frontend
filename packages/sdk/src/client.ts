import type { Decision, Reason, RiskBand, ScreeningResponse } from "@hera/core";
import { HeraBlockedError, HeraError } from "./errors";
import { type FetchFn, type RequestOptions, Transport } from "./http";
import { Alerts, Reports, Screenings, TravelRule, Wallets } from "./resources";
import { type ScreenInput, validateScreen } from "./validate";
import { webhooks } from "./webhooks";

export const DEFAULT_BASE_URL = "https://api.heralayer.com/v1";
export const PROXY_DOCS_URL = "https://github.com/Hera-Protocol/Hera-Frontend/blob/main/docs/SDK.md#keep-the-key-on-a-server-the-proxy-pattern";

const KEY_PATTERN = /^hera_(live|test)_([a-z0-9]{8})_[A-Za-z0-9_-]{20,}$/;

export interface HeraOptions {
  /** `hera_live_…` or `hera_test_…`. Server-side only. */
  apiKey: string;
  /** Default `https://api.heralayer.com/v1`. */
  baseUrl?: string;
  /** Custom fetch, e.g. for proxies, tests or older runtimes. Defaults to `globalThis.fetch`. */
  fetch?: FetchFn;
  /** Per-attempt timeout. Default 15 000 ms. */
  timeoutMs?: number;
  /** Retries for network errors, 429 and (idempotent calls) 5xx. Default 2. */
  maxRetries?: number;
  /** Appended to the SDK's User-Agent, e.g. `my-wallet/3.2.0`. */
  userAgent?: string;
  /**
   * The SDK refuses to start in a browser, because anyone could read the key.
   * Only set this if the key is scoped, short-lived and you accept that risk.
   */
  dangerouslyAllowBrowser?: boolean;
}

export interface GuardOptions extends RequestOptions {
  /** Decisions that stop the transaction. Default `["block"]`. */
  block?: Decision[];
  /** What to do with `review`: let it through (`allow`, the default) or treat it as blocked (`throw`). */
  review?: "throw" | "allow";
  /** Set `false` to get `{ allowed: false }` back instead of a thrown `HeraBlockedError`. Default `true`. */
  throwOnBlock?: boolean;
}

export interface GuardResult {
  /** Whether to go ahead with the transaction. */
  allowed: boolean;
  decision: Decision;
  /** True when Hera said `review` and the guard let it through: queue it for a human. */
  needsReview: boolean;
  score: number;
  band: RiskBand;
  /** Reasons that contributed points, highest first. The full list is on `screening.reasons`. */
  reasons: Reason[];
  screening: ScreeningResponse;
}

function isBrowser(): boolean {
  const g = globalThis as { window?: { document?: unknown } };
  return typeof g.window !== "undefined" && typeof g.window.document !== "undefined";
}

function redact(apiKey: string): string {
  const match = KEY_PATTERN.exec(apiKey);
  return match ? `hera_${match[1]}_${match[2]}_****` : "****";
}

export class Hera {
  /** Webhook verification. Static, so it works without an API key. */
  static readonly webhooks = webhooks;

  readonly screenings: Screenings;
  readonly wallets: Wallets;
  readonly alerts: Alerts;
  readonly travelRule: TravelRule;
  readonly reports: Reports;

  readonly #apiKey: string;
  readonly #transport: Transport;
  readonly #options: { baseUrl: string; timeoutMs: number; maxRetries: number };

  constructor(options: HeraOptions) {
    if (!options || typeof options !== "object") throw new HeraError({ code: "invalid_config", message: "new Hera({ apiKey }) needs an options object." });
    const apiKey = typeof options.apiKey === "string" ? options.apiKey.trim() : "";
    if (!apiKey) {
      throw new HeraError({ code: "invalid_config", message: "Missing apiKey. Create one under Settings → API keys and pass it as new Hera({ apiKey: process.env.HERA_API_KEY })." });
    }
    if (!KEY_PATTERN.test(apiKey)) {
      throw new HeraError({ code: "invalid_config", message: "That doesn't look like a Hera API key. Keys start with hera_live_ or hera_test_ followed by an 8-character prefix and a secret." });
    }
    if (isBrowser() && !options.dangerouslyAllowBrowser) {
      throw new HeraError({
        code: "browser_not_allowed",
        message: `The Hera SDK is running in a browser, where anyone can read your API key. Keep the key on a server and expose a narrow endpoint instead: ${PROXY_DOCS_URL}`,
      });
    }
    const fetchFn = options.fetch ?? (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined);
    if (!fetchFn) throw new HeraError({ code: "invalid_config", message: "No global fetch in this runtime. Pass one as new Hera({ fetch })." });

    const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const timeoutMs = options.timeoutMs ?? 15_000;
    const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 2));

    this.#apiKey = apiKey;
    this.#options = { baseUrl, timeoutMs, maxRetries };
    this.#transport = new Transport({ apiKey, baseUrl, fetch: fetchFn, timeoutMs, maxRetries, userAgent: options.userAgent });
    this.screenings = new Screenings(this.#transport);
    this.wallets = new Wallets(this.#transport);
    this.alerts = new Alerts(this.#transport);
    this.travelRule = new TravelRule(this.#transport);
    this.reports = new Reports(this.#transport);
  }

  /**
   * Screen an address. Accepts `G…`, `M…` (muxed), `G…` with a memo, or `0x…`.
   * The address is parsed locally first, so typos fail without a network call.
   * Scope: `screen`.
   */
  async screen(input: ScreenInput, options?: RequestOptions): Promise<ScreeningResponse> {
    const { body } = validateScreen(input);
    return this.#transport.request<ScreeningResponse>({ method: "POST", path: "/screen", body }, options);
  }

  /**
   * The pre-transaction check: screen the counterparty and throw
   * `HeraBlockedError` if the decision is one you block. Call it before
   * signing a send or crediting a deposit.
   */
  async guard(input: ScreenInput, options: GuardOptions = {}): Promise<GuardResult> {
    const { block = ["block"], review = "allow", throwOnBlock = true, ...requestOptions } = options;
    const screening = await this.screen(input, requestOptions);
    const blocked = block.includes(screening.decision) || (screening.decision === "review" && review === "throw");
    if (blocked && throwOnBlock) throw new HeraBlockedError(screening);
    return {
      allowed: !blocked,
      decision: screening.decision,
      needsReview: !blocked && screening.decision === "review",
      score: screening.score,
      band: screening.band,
      reasons: screening.reasons.filter((r) => r.points > 0).sort((a, b) => b.points - a.points),
      screening,
    };
  }

  /** Safe to log: the key is redacted. */
  toJSON(): Record<string, unknown> {
    return { apiKey: redact(this.#apiKey), ...this.#options };
  }

  toString(): string {
    return `Hera(${JSON.stringify(this.toJSON())})`;
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }
}
