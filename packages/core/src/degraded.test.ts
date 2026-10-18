import { describe, expect, it } from "vitest";
import { ChainDataError, type FetchLike, getJson } from "./adapters/http";
import { createLabelIndex, SEED_LABELS } from "./labels";
import { screenSubject } from "./screen";
import { LABEL_CATEGORIES, REASON_CODES, type ReasonCode, TRANSFER_KINDS } from "./types";

const labels = createLabelIndex(SEED_LABELS);
const SANCTIONED = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";
const UNLABELED = "0x1111111111111111111111111111111111111111";
const CIRCLE = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const UNLABELED_G = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
const NOW = new Date("2026-10-18T12:00:00Z");

/** A fetch that ignores its AbortSignal and never settles: the worst case for a deadline. */
const hang: FetchLike = () => new Promise<Response>(() => {});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const fast = { deadlineMs: 300, timeoutMs: 300 };

describe("degraded chain data", () => {
  it("a sanctioned subject is blocked at 100 even when no source answers", async () => {
    const started = Date.now();
    const r = await screenSubject({ chain: "evm:1", address: SANCTIONED }, { labels, fetch: hang, now: NOW, ...fast });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(r.score).toBe(100);
    expect(r.decision).toBe("block");
    expect(r.profile.dataStatus).toBe("unavailable");
    expect(r.profile.window?.truncatedBy).toBe("deadline");
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(["SANCTIONS_DIRECT", "CHAIN_DATA_PARTIAL"]));
    expect(r.reasons.find((x) => x.code === "CHAIN_DATA_PARTIAL")).toMatchObject({ points: 0, severity: "info" });
  });

  it("a labeled Stellar subject is scored on its labels when Horizon is down", async () => {
    const r = await screenSubject({ chain: "stellar", account: CIRCLE }, { labels, fetch: async () => json({}, 503), now: NOW, ...fast });
    expect(r.profile.dataStatus).toBe("unavailable");
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(["KNOWN_ENTITY", "CHAIN_DATA_PARTIAL"]));
  });

  it("throws a timeout ChainDataError when nothing answers and there are no labels", async () => {
    for (const subject of [{ chain: "evm:1" as const, address: UNLABELED as `0x${string}` }, { chain: "stellar" as const, account: UNLABELED_G }]) {
      const error = await screenSubject(subject, { labels, fetch: hang, now: NOW, ...fast }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ChainDataError);
      expect((error as ChainDataError).kind).toBe("timeout");
    }
  });

  it("scores what arrived when only some sources answer, and says which are missing", async () => {
    const fetch: FetchLike = async (url) => {
      if (/addresses\/0x[0-9a-fA-F]+$/.test(url)) return json({ hash: UNLABELED, coin_balance: "0", is_contract: false, ens_domain_name: null });
      if (url.includes("/token-transfers")) {
        return json({
          items: [{ transaction_hash: "0xa", log_index: 0, timestamp: "2026-10-10T00:00:00.000000Z", from: { hash: SANCTIONED }, to: { hash: UNLABELED }, total: { value: "1000000", decimals: "6" }, token: { symbol: "USDC", address_hash: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", type: "ERC-20", decimals: "6" } }],
          next_page_params: null,
        });
      }
      return hang(url);
    };
    const r = await screenSubject({ chain: "evm:1", address: UNLABELED }, { labels, fetch, now: NOW, ...fast });
    expect(r.profile.dataStatus).toBe("partial");
    expect(r.profile.window).toMatchObject({ truncatedBy: "deadline", missing: ["transactions", "internal"] });
    expect(r.profile.fullHistory).toBe(false);
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(["COUNTERPARTY_EXPOSURE", "CHAIN_DATA_PARTIAL"]));
    expect(r.reasons.find((x) => x.code === "CHAIN_DATA_PARTIAL")!.detail).toContain("transactions, internal");
    expect(r.band).toBe("severe");
  });

  it("Horizon: account answers, payments time out → partial, not a 502", async () => {
    const fetch: FetchLike = async (url) =>
      url.endsWith(`/accounts/${UNLABELED_G}`)
        ? json({ account_id: UNLABELED_G, flags: { auth_required: false, auth_revocable: false, auth_clawback_enabled: false }, balances: [] })
        : hang(url);
    const r = await screenSubject({ chain: "stellar", account: UNLABELED_G }, { labels, fetch, now: NOW, ...fast });
    expect(r.profile.dataStatus).toBe("partial");
    expect(r.profile.window?.missing).toEqual(["payments", "operations"]);
    expect(r.reasons.map((x) => x.code)).toContain("CHAIN_DATA_PARTIAL");
  });

  it("complete data says so and adds no partial-data reason", async () => {
    const fetch: FetchLike = async (url) =>
      /addresses\/0x[0-9a-fA-F]+$/.test(url) ? json({ hash: UNLABELED, coin_balance: "0", is_contract: false, ens_domain_name: null }) : json({ items: [], next_page_params: null });
    const r = await screenSubject({ chain: "evm:1", address: UNLABELED }, { labels, fetch, now: NOW });
    expect(r.profile.dataStatus).toBe("complete");
    expect(r.reasons.map((x) => x.code)).not.toContain("CHAIN_DATA_PARTIAL");
  });
});

describe("ChainDataError kinds", () => {
  it("distinguishes timeout, http, network and malformed", async () => {
    const kind = (fetch: FetchLike) => getJson("https://x/a", { fetch, timeoutMs: 200 }).catch((e: ChainDataError) => [e.kind, e.status]);
    expect(await kind(hang)).toEqual(["timeout", undefined]);
    expect(await kind(async () => json({}, 500))).toEqual(["http", 500]);
    expect(await kind(async () => { throw new TypeError("fetch failed"); })).toEqual(["network", undefined]);
    expect(await kind(async () => new Response("<html>", { status: 200 }))).toEqual(["malformed", 200]);
    // Backward compatible: two-argument construction still works.
    expect(new ChainDataError("x", 502).kind).toBe("http");
    expect(new ChainDataError("x").kind).toBe("network");
  });
});

describe("runtime enums", () => {
  it("exports the unions as arrays", () => {
    const code: ReasonCode = REASON_CODES[0];
    expect(code).toBe("SANCTIONS_DIRECT");
    expect(REASON_CODES).toContain("CHAIN_DATA_PARTIAL");
    expect(new Set(REASON_CODES).size).toBe(REASON_CODES.length);
    expect(TRANSFER_KINDS).toContain("claim");
    expect(LABEL_CATEGORIES).toContain("sanctions");
  });
});
