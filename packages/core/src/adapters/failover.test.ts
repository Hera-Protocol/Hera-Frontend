import { describe, expect, it } from "vitest";
import { createFailoverFetch } from "./failover";
import type { FetchLike } from "./http";

const A = "https://horizon.a.example";
const B = "https://horizon.b.example";

function stub(handler: (url: string, signal?: AbortSignal | null) => Promise<Response> | Response) {
  const calls: string[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push(url);
    return handler(url, init?.signal);
  };
  return { fetch, calls };
}

const ok = () => new Response("{}", { status: 200 });

describe("createFailoverFetch", () => {
  it("passes through URLs that belong to no group", async () => {
    const s = stub(ok);
    const f = createFailoverFetch([[A, B]], { fetch: s.fetch });
    await f("https://other.example/x");
    expect(s.calls).toEqual(["https://other.example/x"]);
  });

  it("uses the primary while it is healthy", async () => {
    const s = stub(ok);
    const f = createFailoverFetch([[A, B]], { fetch: s.fetch });
    await f(`${A}/accounts/G1?limit=2`);
    expect(s.calls).toEqual([`${A}/accounts/G1?limit=2`]);
  });

  it("fails over on 5xx and 429, keeping path and query", async () => {
    const s = stub((url) => (url.startsWith(A) ? new Response("busy", { status: 503 }) : ok()));
    const f = createFailoverFetch([[A, B]], { fetch: s.fetch });
    const res = await f(`${A}/accounts/G1/payments?limit=200&order=desc`);
    expect(res.status).toBe(200);
    expect(s.calls).toEqual([`${A}/accounts/G1/payments?limit=200&order=desc`, `${B}/accounts/G1/payments?limit=200&order=desc`]);
  });

  it("does not fail over on 404: that's a real answer", async () => {
    const s = stub(() => new Response("nope", { status: 404 }));
    const f = createFailoverFetch([[A, B]], { fetch: s.fetch });
    expect((await f(`${A}/accounts/G1`)).status).toBe(404);
    expect(s.calls).toHaveLength(1);
  });

  it("fails over on network errors and cools the failed endpoint down", async () => {
    let t = 0;
    const s = stub((url) => {
      if (url.startsWith(A)) throw new TypeError("fetch failed");
      return ok();
    });
    const f = createFailoverFetch([[A, B]], { fetch: s.fetch, now: () => t, cooldownMs: 1000 });
    await f(`${A}/x`);
    await f(`${A}/y`); // A is cooling: B first, A never called
    expect(s.calls).toEqual([`${A}/x`, `${B}/x`, `${B}/y`]);
    t = 2000; // cooldown over: A is tried first again
    await f(`${A}/z`).catch(() => undefined);
    expect(s.calls.at(-2)).toBe(`${A}/z`);
  });

  it("gives each non-final endpoint an attempt timeout", async () => {
    const s = stub((url, signal) => {
      if (url.startsWith(A)) return new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason)));
      return ok();
    });
    const f = createFailoverFetch([[A, B]], { fetch: s.fetch, attemptTimeoutMs: 20 });
    expect((await f(`${A}/slow`)).status).toBe(200);
    expect(s.calls).toEqual([`${A}/slow`, `${B}/slow`]);
  });

  it("stops when the caller aborts instead of trying the rest", async () => {
    const s = stub((_url, signal) => new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    const f = createFailoverFetch([[A, B]], { fetch: s.fetch, attemptTimeoutMs: 10_000 });
    const controller = new AbortController();
    const pending = f(`${A}/x`, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(s.calls).toHaveLength(1);
  });

  it("adds a base's query parameters (API keys) and matches requests made against the keyless primary", async () => {
    const s = stub((url) => (url.includes("eth.blockscout") ? new Response("x", { status: 502 }) : ok()));
    const f = createFailoverFetch([["https://eth.blockscout.com/api/v2", "https://api.blockscout.com/1/api/v2?apikey=k123"]], { fetch: s.fetch });
    await f("https://eth.blockscout.com/api/v2/addresses/0xabc/transactions?block_number=5");
    expect(s.calls[1]).toBe("https://api.blockscout.com/1/api/v2/addresses/0xabc/transactions?block_number=5&apikey=k123");
  });

  it("returns the last endpoint's error response when everything is down", async () => {
    const s = stub(() => new Response("down", { status: 503 }));
    const f = createFailoverFetch([[A, B]], { fetch: s.fetch });
    expect((await f(`${A}/x`)).status).toBe(503);
    expect(s.calls).toHaveLength(2);
  });

  it("never logs credentials from base query strings", async () => {
    const events: string[] = [];
    const s = stub((url) => (url.includes("apikey") ? ok() : new Response("x", { status: 500 })));
    const f = createFailoverFetch([["https://free.example/api", "https://pro.example/api?apikey=secret"]], {
      fetch: s.fetch,
      onFailover: (e) => events.push(`${e.from} ${e.reason}`),
    });
    await f("https://free.example/api/x");
    expect(events.join()).not.toContain("secret");
  });
});
