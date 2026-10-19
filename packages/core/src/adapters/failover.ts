import type { FetchLike } from "./http";

/**
 * A fetch that fails over between interchangeable API endpoints.
 *
 * Each group lists base URLs that serve the same API (e.g. two Horizon
 * instances, or Blockscout's free instance and its keyed PRO API). A request
 * whose URL starts with any base in a group is tried against the group's
 * endpoints in order of health: endpoints that failed recently are cooled
 * down and moved to the back, so traffic routes around an outage and comes
 * back automatically once the cooldown expires.
 *
 * Failing over on: network errors, a per-attempt timeout, 429 and 5xx.
 * Not on 404 or other 4xx: those are real answers.
 *
 * A base may carry query parameters (e.g. `?apikey=…`); they are added to
 * every request sent to that base, and stripped when matching.
 */

export interface FailoverOptions {
  fetch?: FetchLike;
  /** Time one endpoint gets before the next is tried. The caller's own signal still bounds the whole request. */
  attemptTimeoutMs?: number;
  /** How long a failed endpoint stays at the back of the line. */
  cooldownMs?: number;
  now?: () => number;
  onFailover?: (event: { from: string; reason: string }) => void;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

interface Endpoint {
  /** Base without query string, no trailing slash: what request URLs are matched and rebuilt against. */
  prefix: string;
  /** Query parameters added to every request for this endpoint. */
  params: URLSearchParams;
  /** Host label for logs; never includes credentials or query parameters. */
  label: string;
  coolUntil: number;
}

function parseBase(base: string): Endpoint {
  const url = new URL(base);
  const params = new URLSearchParams(url.search);
  url.search = "";
  url.hash = "";
  return { prefix: url.toString().replace(/\/+$/, ""), params, label: url.host, coolUntil: 0 };
}

function matches(url: string, prefix: string): boolean {
  return url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`);
}

export function createFailoverFetch(groups: string[][], options: FailoverOptions = {}): FetchLike {
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const attemptTimeoutMs = options.attemptTimeoutMs ?? 6_000;
  const cooldownMs = options.cooldownMs ?? 60_000;
  const now = options.now ?? Date.now;
  const pools = groups.filter((g) => g.length > 0).map((g) => g.map(parseBase));

  return async (input, init) => {
    const pool = pools.find((p) => p.some((e) => matches(input, e.prefix)));
    if (!pool || pool.length === 1) return doFetch(input, init);

    const source = pool.find((e) => matches(input, e.prefix))!;
    const suffix = input.slice(source.prefix.length);
    // Healthy endpoints first, in configured order; cooling ones after, soonest-recovering first.
    const t = now();
    const order = [...pool].sort((a, b) => {
      const ac = a.coolUntil > t, bc = b.coolUntil > t;
      if (ac !== bc) return ac ? 1 : -1;
      return ac ? a.coolUntil - b.coolUntil : pool.indexOf(a) - pool.indexOf(b);
    });

    let lastError: unknown;
    for (let i = 0; i < order.length; i++) {
      const endpoint = order[i]!;
      const last = i === order.length - 1;
      const target = new URL(endpoint.prefix + suffix);
      endpoint.params.forEach((value, key) => target.searchParams.set(key, value));

      const callerSignal = init?.signal ?? undefined;
      if (callerSignal?.aborted) throw callerSignal.reason ?? new Error("aborted");
      const attempt = new AbortController();
      const onAbort = () => attempt.abort(callerSignal?.reason);
      callerSignal?.addEventListener("abort", onAbort, { once: true });
      // The last endpoint runs under the caller's budget alone; earlier ones get a slice so a hung mirror can't eat it.
      const timer = last ? undefined : setTimeout(() => attempt.abort(new Error(`${endpoint.label} timed out after ${attemptTimeoutMs} ms`)), attemptTimeoutMs);

      const fail = (reason: string) => {
        endpoint.coolUntil = now() + cooldownMs;
        options.onFailover?.({ from: endpoint.label, reason });
      };

      try {
        const response = await doFetch(target.toString(), { ...init, signal: attempt.signal });
        if (RETRYABLE_STATUS.has(response.status) && !last) {
          fail(`HTTP ${response.status}`);
          await response.body?.cancel().catch(() => undefined);
          continue;
        }
        if (response.ok) endpoint.coolUntil = 0;
        return response;
      } catch (error) {
        // The caller gave up: stop, don't burn through the other endpoints.
        if (callerSignal?.aborted) throw error;
        lastError = error;
        fail(error instanceof Error ? error.message : String(error));
        if (last) throw error;
      } finally {
        clearTimeout(timer);
        callerSignal?.removeEventListener("abort", onAbort);
      }
    }
    throw lastError ?? new Error("All endpoints failed");
  };
}
