import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeraConnectionError, HeraError, HeraRateLimitError } from "../src";
import { backoffDelay, parseRetryAfter } from "../src/http";
import { apiError, type Call, client, G, json, mockFetch, screening } from "./helpers";

const fail = () => {
  throw new TypeError("fetch failed");
};
const serverError = () => apiError(503, "chain_unavailable", "Horizon is unavailable.");
const rateLimited = (retryAfter?: string) => () => apiError(429, "rate_limited", "Too many requests.", { headers: retryAfter ? { "retry-after": retryAfter } : {} });
/** Never answers; rejects when the SDK aborts it. */
const hang = (call: Call) =>
  new Promise<Response>((_, reject) => call.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Start a call and let fake time run until it settles. */
async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  const result = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  return result;
}

describe("backoff", () => {
  it("is exponential with jitter, capped at 8 s", () => {
    expect([0, 1, 2, 3, 4, 10].map((n) => backoffDelay(n, () => 0))).toEqual([250, 500, 1000, 2000, 4000, 4000]);
    expect([0, 1, 2, 3, 4, 10].map((n) => backoffDelay(n, () => 1))).toEqual([500, 1000, 2000, 4000, 8000, 8000]);
  });

  it("parses Retry-After as seconds or an HTTP date", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter("1.5")).toBe(1500);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(parseRetryAfter("soon")).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});

describe("retries on idempotent calls (GET)", () => {
  it("retries 5xx with backoff, then succeeds", async () => {
    const { fetch, calls } = mockFetch(serverError, serverError, json([]));
    const started = Date.now();
    const { value } = await settle(client(fetch).wallets.list());
    expect(value).toEqual([]);
    expect(calls).toHaveLength(3);
    // random=0.5 → 375 ms then 750 ms
    expect(Date.now() - started).toBe(375 + 750);
  });

  it("gives up after maxRetries and surfaces the last error", async () => {
    const { fetch, calls } = mockFetch(serverError);
    const { error } = await settle(client(fetch, { maxRetries: 3 }).alerts.list());
    expect(calls).toHaveLength(4);
    expect(error).toMatchObject({ status: 503, code: "chain_unavailable" });
  });

  it("retries network errors and timeouts", async () => {
    const { fetch, calls } = mockFetch(fail, hang, json({ items: [], total: 0 }));
    const { value } = await settle(client(fetch, { timeoutMs: 1000 }).screenings.list());
    expect(value).toEqual({ items: [], total: 0 });
    expect(calls).toHaveLength(3);
  });

  it("reports a timeout as HeraConnectionError(timeout)", async () => {
    const { fetch } = mockFetch(hang);
    const { error } = await settle(client(fetch, { timeoutMs: 1000, maxRetries: 0 }).wallets.list());
    expect(error).toBeInstanceOf(HeraConnectionError);
    expect(error).toMatchObject({ code: "timeout" });
  });

  it("does not retry 4xx other than 408/429", async () => {
    const { fetch, calls } = mockFetch(apiError(404, "not_found", "That alert was not found."));
    const { error } = await settle(client(fetch).alerts.get("0b9c2c62-5f37-4c8e-9a51-3f0c7c1c0d11"));
    expect(calls).toHaveLength(1);
    expect(error).toMatchObject({ status: 404 });
  });

  it("respects a per-call maxRetries override", async () => {
    const { fetch, calls } = mockFetch(serverError);
    await settle(client(fetch).wallets.list({ maxRetries: 0 }));
    expect(calls).toHaveLength(1);
  });
});

describe("retries on non-idempotent calls (POST, PATCH)", () => {
  it("does not retry 5xx: the server may have acted", async () => {
    const { fetch, calls } = mockFetch(serverError, json(screening()));
    const { error } = await settle(client(fetch).screen(G));
    expect(calls).toHaveLength(1);
    expect(error).toBeInstanceOf(HeraError);
  });

  it("retries a connection failure before any response", async () => {
    const { fetch, calls } = mockFetch(fail, json(screening()));
    const { value } = await settle(client(fetch).screen(G));
    expect(calls).toHaveLength(2);
    expect(value).toMatchObject({ decision: "allow" });
  });

  it("does not retry a timeout, since the request may have been processed", async () => {
    const { fetch, calls } = mockFetch(hang, json(screening()));
    const { error } = await settle(client(fetch, { timeoutMs: 500 }).screen(G));
    expect(calls).toHaveLength(1);
    expect(error).toMatchObject({ code: "timeout" });
  });

  it("retries 429, honoring Retry-After exactly", async () => {
    const { fetch, calls } = mockFetch(rateLimited("2"), json(screening()));
    const started = Date.now();
    const { value } = await settle(client(fetch).screen(G));
    expect(value).toBeDefined();
    expect(calls).toHaveLength(2);
    expect(Date.now() - started).toBe(2000);
  });

  it("uses backoff when 429 has no Retry-After", async () => {
    const { fetch } = mockFetch(rateLimited(), json(screening()));
    const started = Date.now();
    await settle(client(fetch).screen(G));
    expect(Date.now() - started).toBe(375);
  });

  it("surfaces a long Retry-After immediately instead of sleeping on it", async () => {
    const { fetch, calls } = mockFetch(rateLimited("3600"));
    const started = Date.now();
    const { error } = await settle(client(fetch).screen(G));
    expect(calls).toHaveLength(1);
    expect(Date.now() - started).toBe(0);
    expect(error).toBeInstanceOf(HeraRateLimitError);
    expect((error as HeraRateLimitError).retryAfter).toBe(3600);
  });

  it("throws HeraRateLimitError when 429 persists", async () => {
    const { fetch, calls } = mockFetch(rateLimited("1"));
    const { error } = await settle(client(fetch, { maxRetries: 2 }).screen(G));
    expect(calls).toHaveLength(3);
    expect(error).toBeInstanceOf(HeraRateLimitError);
  });
});

describe("cancellation", () => {
  it("an aborted signal stops the call and pending retries", async () => {
    const controller = new AbortController();
    const { fetch, calls } = mockFetch(serverError);
    const promise = client(fetch).wallets.list({ signal: controller.signal });
    const result = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10);
    controller.abort(new Error("user navigated away"));
    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({ message: "user navigated away" });
    expect(calls).toHaveLength(1);
  });

  it("an already-aborted signal never retries", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    const { fetch, calls } = mockFetch((call) => {
      if (call.signal?.aborted) throw new DOMException("aborted", "AbortError");
      return json([]);
    });
    const { error } = await settle(client(fetch).wallets.list({ signal: controller.signal }));
    expect(error).toMatchObject({ message: "cancelled" });
    expect(calls).toHaveLength(1);
  });
});
