import { inspect } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { Hera, HeraError, SDK_VERSION } from "../src";
import { BASE, client, json, KEY, mockFetch, screening } from "./helpers";

describe("construction", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("requires an api key", () => {
    expect(() => new Hera({ apiKey: "" })).toThrow(/Missing apiKey/);
    expect(() => new Hera({} as never)).toThrow(/Missing apiKey/);
    expect(() => new Hera(undefined as never)).toThrow(HeraError);
  });

  it("rejects strings that aren't Hera keys", () => {
    for (const bad of ["sk_live_123", "hera_live_short", "hera_prod_abcd2345_s3cr3tS3cr3tS3cr3tS3cr3t", "Bearer hera_live_abcd2345_s3cr3tS3cr3tS3cr3tS3cr3t"]) {
      expect(() => new Hera({ apiKey: bad }), bad).toThrow(/doesn't look like a Hera API key/);
    }
  });

  it("accepts live and test keys", () => {
    expect(() => new Hera({ apiKey: KEY })).not.toThrow();
    expect(() => new Hera({ apiKey: KEY.replace("live", "test") })).not.toThrow();
  });

  it("refuses to run in a browser unless explicitly allowed", () => {
    (globalThis as { window?: unknown }).window = { document: {} };
    expect(() => new Hera({ apiKey: KEY })).toThrow(/running in a browser.*docs\/SDK\.md#keep-the-key-on-a-server/);
    try {
      new Hera({ apiKey: KEY });
    } catch (error) {
      expect((error as HeraError).code).toBe("browser_not_allowed");
      expect((error as HeraError).message).not.toContain(KEY);
    }
    expect(() => new Hera({ apiKey: KEY, dangerouslyAllowBrowser: true })).not.toThrow();
  });

  it("doesn't mistake a window without a document (e.g. Deno 1) for a browser", () => {
    (globalThis as { window?: unknown }).window = {};
    expect(() => new Hera({ apiKey: KEY })).not.toThrow();
  });
});

describe("key redaction", () => {
  const hera = new Hera({ apiKey: KEY, baseUrl: BASE });
  const secret = KEY.split("_").slice(3).join("_");

  it("never serializes the secret", () => {
    expect(hera.toJSON()).toEqual({ apiKey: "hera_live_abcd2345_****", baseUrl: BASE, timeoutMs: 15000, maxRetries: 2 });
    for (const text of [JSON.stringify(hera), String(hera), inspect(hera), inspect(hera, { showHidden: true, depth: 10 })]) {
      expect(text).not.toContain(secret);
    }
  });

  it("keeps the key off enumerable properties", () => {
    expect(Object.values(hera).some((v) => typeof v === "string" && v.includes(secret))).toBe(false);
    expect(JSON.stringify(Object.entries(hera))).not.toContain(secret);
  });
});

describe("request building", () => {
  it("sends the bearer key, JSON headers and a user agent", async () => {
    const { fetch, calls } = mockFetch(json(screening()));
    await client(fetch, { userAgent: "my-wallet/3.2.0" }).screen("GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
    const call = calls[0]!;
    expect(call.url).toBe(`${BASE}/screen`);
    expect(call.method).toBe("POST");
    expect(call.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(call.headers["content-type"]).toBe("application/json");
    expect(call.headers.accept).toBe("application/json");
    expect(call.headers["user-agent"]).toBe(`hera-sdk-js/${SDK_VERSION} my-wallet/3.2.0`);
    expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it("strips trailing slashes from baseUrl and defaults to the production API", async () => {
    const { fetch, calls } = mockFetch(json({ items: [], total: 0 }));
    await new Hera({ apiKey: KEY, baseUrl: `${BASE}///`, fetch }).screenings.list();
    expect(calls[0]!.url).toBe(`${BASE}/screenings`);
    expect(new Hera({ apiKey: KEY }).toJSON().baseUrl).toBe("https://api.heralayer.com/v1");
  });

  it("sends no body or content-type on GET", async () => {
    const { fetch, calls } = mockFetch(json([]));
    await client(fetch).wallets.list();
    expect(calls[0]!.body).toBeUndefined();
    expect(calls[0]!.headers["content-type"]).toBeUndefined();
  });

  it("falls back to global fetch", async () => {
    const original = globalThis.fetch;
    const { fetch, calls } = mockFetch(json([]));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    try {
      await new Hera({ apiKey: KEY, baseUrl: BASE }).alerts.list();
      expect(calls).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
