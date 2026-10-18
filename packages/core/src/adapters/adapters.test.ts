import { describe, expect, it } from "vitest";
import { isDust } from "../dust";
import { memoMatches, normalizeMemo } from "../stellar/memo";
import { looksLikeOmnibus, sharedAccountEvidence } from "../stellar/omnibus";
import type { Transfer } from "../types";
import { eip7702Delegate, fetchEvmAccount, normalizeBlockscout } from "./blockscout";
import { fetchStellarAccount, type HorizonPaymentRecord, normalizeClaim, normalizeHorizonRecord } from "./horizon";
import { Deadline, type FetchLike, getPaged } from "./http";

const G = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
const H = "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM";
const HEX = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const B64 = btoa(String.fromCharCode(...HEX.match(/../g)!.map((h) => Number.parseInt(h, 16))));

const payment = (over: Partial<HorizonPaymentRecord> = {}): HorizonPaymentRecord => ({
  id: "1",
  type: "payment",
  created_at: "2026-10-18T00:00:00Z",
  transaction_hash: "abc",
  transaction_successful: true,
  from: G,
  to: H,
  amount: "10.0000000",
  asset_type: "native",
  ...over,
});

describe("Horizon memos", () => {
  it("normalizes hash and return memos from base64 to hex", () => {
    expect(normalizeMemo("hash", B64)).toEqual({ type: "hash", value: HEX });
    expect(normalizeMemo("return", B64)).toEqual({ type: "return", value: HEX });
    expect(normalizeMemo("none", undefined)).toBeUndefined();
    expect(normalizeMemo("id", "42")).toEqual({ type: "id", value: "42" });
  });

  it("matches hex input against hash and return memos, in either encoding", () => {
    const sub = { kind: "memo" as const, type: "hash" as const, value: HEX.toUpperCase() };
    expect(memoMatches(sub, { type: "hash", value: HEX })).toBe(true);
    expect(memoMatches(sub, { type: "return", value: HEX })).toBe(true);
    expect(memoMatches(sub, { type: "hash", value: B64 })).toBe(true); // stored by an older engine
    expect(memoMatches(sub, { type: "text", value: HEX })).toBe(false);
    expect(memoMatches(sub, { type: "hash", value: "f".repeat(64) })).toBe(false);
  });

  it("matches id memos numerically and text memos exactly", () => {
    expect(memoMatches({ kind: "memo", type: "id", value: "0042" }, { type: "id", value: "42" })).toBe(true);
    expect(memoMatches({ kind: "memo", type: "id", value: "42" }, { type: "text", value: "42" })).toBe(false);
    expect(memoMatches({ kind: "memo", type: "text", value: "abc" }, { type: "text", value: "ABC" })).toBe(false);
  });

  it("carries the normalized memo onto transfers", () => {
    const [t] = normalizeHorizonRecord(payment({ transaction: { memo_type: "return", memo: B64 } }));
    expect(t!.memo).toEqual({ type: "return", value: HEX });
  });
});

describe("Horizon operations", () => {
  it("records the source asset and amount of a path payment", () => {
    const [t] = normalizeHorizonRecord(
      payment({
        type: "path_payment_strict_receive",
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        source_asset_type: "credit_alphanum4",
        source_asset_code: "RISK",
        source_asset_issuer: G,
        source_amount: "123.4000000",
      }),
    );
    expect(t!.kind).toBe("path_payment");
    expect(t!.sourceAsset).toEqual({ code: "RISK", issuer: G, decimals: 7 });
    expect(t!.sourceAmount).toBe("123.4000000");
  });

  it("keeps muxed ids on create_account and account_merge", () => {
    const [created] = normalizeHorizonRecord(payment({ type: "create_account", funder: G, funder_muxed_id: "7", account: H, starting_balance: "5" }));
    expect(created!.from).toEqual({ address: G, muxedId: "7" });
    const [merged] = normalizeHorizonRecord(payment({ type: "account_merge", account: G, account_muxed_id: "1", into: H, into_muxed_id: "2" }));
    expect(merged!.from.muxedId).toBe("1");
    expect(merged!.to.muxedId).toBe("2");
  });

  it("turns a claimed claimable balance into a transfer from creator to claimant", () => {
    const ops = [
      { id: "10", type: "create_claimable_balance", created_at: "2026-10-01T00:00:00Z", source_account: G, asset: `USDC:${H}`, amount: "50.0000000", transaction_hash: "c1", transaction: { memo_type: "id", memo: "9" } },
      { id: "11", type: "claim_claimable_balance", created_at: "2026-10-02T00:00:00Z", source_account: H, claimant: H, balance_id: "b", transaction_hash: "c2", transaction_successful: true },
    ];
    expect(normalizeClaim(ops)).toMatchObject({
      kind: "claim",
      txHash: "c2",
      timestamp: "2026-10-02T00:00:00Z",
      from: { address: G },
      to: { address: H },
      asset: { code: "USDC", issuer: H },
      amount: "50.0000000",
      memo: { type: "id", value: "9" },
    });
    // Unclaimed, or reclaimed by the creator: no value moved to anyone else.
    expect(normalizeClaim(ops.slice(0, 1))).toBeNull();
    expect(normalizeClaim([ops[0]!, { ...ops[1]!, claimant: G, source_account: G }])).toBeNull();
  });
});

describe("dust", () => {
  const t = (over: Partial<Transfer>): Transfer => ({
    id: "x", chain: "stellar", txHash: "h", timestamp: "2026-10-18T00:00:00Z", kind: "payment",
    from: { address: G }, to: { address: H }, asset: { code: "XLM", decimals: 7 }, amount: "1", successful: true, ...over,
  });
  it("applies per-asset thresholds", () => {
    expect(isDust(t({ amount: "0.0000001" }))).toBe(true);
    expect(isDust(t({ amount: "0.0010000" }))).toBe(false);
    expect(isDust(t({ asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", decimals: 7 }, amount: "0.005" }))).toBe(true);
    // A tiny amount of an unknown asset may be worth a lot (e.g. a BTC token): keep it.
    expect(isDust(t({ asset: { code: "BTC", issuer: G, decimals: 7 }, amount: "0.0005" }))).toBe(false);
    expect(isDust(t({ kind: "merge", amount: "0" }))).toBe(false);
    expect(isDust(t({ kind: "create_account", amount: "0" }))).toBe(false);
  });
  it("drops zero-value EVM token transfers (address poisoning)", () => {
    expect(isDust(t({ chain: "evm:1", kind: "erc20", asset: { code: "USDT", issuer: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 }, amount: "0" }))).toBe(true);
    expect(isDust(t({ chain: "evm:1", kind: "erc20", asset: { code: "PEPE", issuer: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", decimals: 18 }, amount: "0.000001" }))).toBe(false);
  });
});

describe("shared-account rule", () => {
  const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  const inbound = (to: string, memo: Transfer["memo"], over: Partial<Transfer> = {}): Transfer => ({
    id: Math.random().toString(), chain: "stellar", txHash: "h", timestamp: "2026-10-18T00:00:00Z", kind: "payment",
    from: { address: G }, to: { address: to }, asset: { code: "XLM", decimals: 7 }, amount: "5", successful: true, memo, ...over,
  });

  it("does not count burns of the account's own asset (Circle's 'internal' memos)", () => {
    const burns = Array.from({ length: 50 }, (_, i) => inbound(ISSUER, { type: "id", value: String(i) }, { asset: { code: "USDC", issuer: ISSUER, decimals: 7 } }));
    const e = sharedAccountEvidence(ISSUER, burns);
    expect(e.eligibleInbound).toBe(0);
    expect(looksLikeOmnibus(e)).toBe(false);
  });

  it("ignores spam text memos and repeated single memos", () => {
    const spam = Array.from({ length: 30 }, () => inbound(H, { type: "text", value: "Buy NXR & Earn Native XLM!" }));
    expect(looksLikeOmnibus(sharedAccountEvidence(H, spam))).toBe(false);
    const oneSender = Array.from({ length: 30 }, () => inbound(H, { type: "id", value: "77" }));
    expect(looksLikeOmnibus(sharedAccountEvidence(H, oneSender))).toBe(false);
  });

  it("counts id memos, muxed ids and identifier-like text memos across many customers", () => {
    const mixed = [
      ...Array.from({ length: 4 }, (_, i) => inbound(H, { type: "id", value: String(100 + i) })),
      ...Array.from({ length: 4 }, (_, i) => inbound(H, undefined, { to: { address: H, muxedId: String(i) } })),
      ...Array.from({ length: 4 }, (_, i) => inbound(H, { type: "text", value: `40116763${i}` })),
    ];
    const e = sharedAccountEvidence(H, mixed);
    expect(e).toMatchObject({ eligibleInbound: 12, routedInbound: 12, distinctRoutes: 12 });
    expect(looksLikeOmnibus(e)).toBe(true);
  });
});

describe("Blockscout normalization", () => {
  const A = "0x1111111111111111111111111111111111111111";
  const B = "0x2222222222222222222222222222222222222222";
  const ts = "2026-10-18T00:00:00.000000Z";

  it("marks reverted transactions, failed calls and their logs unsuccessful, and skips delegatecalls", () => {
    const transfers = normalizeBlockscout(
      "evm:1",
      [
        { hash: "0xok", timestamp: ts, from: { hash: A }, to: { hash: B }, value: "1", status: "ok" },
        { hash: "0xbad", timestamp: ts, from: { hash: A }, to: { hash: B }, value: "1", status: "error" },
        { hash: "0xpending", timestamp: ts, from: { hash: A }, to: { hash: B }, value: "1", status: null },
      ],
      [
        { transaction_hash: "0xx", index: 1, timestamp: ts, type: "call", from: { hash: B }, to: { hash: A }, value: "5", success: false },
        { transaction_hash: "0xbad", index: 2, timestamp: ts, type: "call", from: { hash: B }, to: { hash: A }, value: "5", success: true },
        { transaction_hash: "0xy", index: 3, timestamp: ts, type: "delegatecall", from: { hash: B }, to: { hash: A }, value: "5", success: true },
      ],
      [
        { transaction_hash: "0xbad", log_index: 0, timestamp: ts, from: { hash: B }, to: { hash: A }, total: { value: "1", decimals: "0" }, token: { symbol: "T", address_hash: B, type: "ERC-20", decimals: "0" } },
      ],
    );
    const ok = Object.fromEntries(transfers.map((t) => [t.id, t.successful]));
    expect(ok).toEqual({
      "0xok:tx": true,
      "0xbad:tx": false,
      "0xpending:tx": false,
      "0xx:itx:1": false,
      "0xbad:itx:2": false,
      "0xbad:log:0": false,
    });
  });

  it("detects EIP-7702 delegation from proxy_type, or from the 0xef0100 code prefix", () => {
    const base = { hash: A, coin_balance: "0", is_contract: true, ens_domain_name: null };
    expect(eip7702Delegate({ ...base, proxy_type: "eip7702", implementations: [{ address_hash: "0x5a7fc11397e9a8ad41bf10bf13f22b0a63f96f6d" }] })).toEqual({
      delegatedTo: "0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d",
    });
    expect(eip7702Delegate(base, { deployed_bytecode: "0xef01005a7fc11397e9a8ad41bf10bf13f22b0a63f96f6d" })).toEqual({
      delegatedTo: "0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d",
    });
    // A real proxy contract (USDC) is not a delegation.
    expect(eip7702Delegate({ ...base, proxy_type: "eip1967_oz", implementations: [{ address_hash: B }] })).toBeNull();
    expect(eip7702Delegate(base, { deployed_bytecode: "0x6080604052" })).toBeNull();
  });
});

/* ─── Paging, budgets and deadlines ──────────────────── */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("getPaged", () => {
  type Page = { n: number; more: boolean };
  const next = (p: Page) => (p.more ? `https://x/p?n=${p.n + 1}` : null);
  const serve = (pages: number, delayMs = 0): FetchLike => async (url) => {
    const n = Number(new URL(url).searchParams.get("n") ?? 1);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return json({ n, more: n < pages });
  };

  it("stops on the page budget", async () => {
    const r = await getPaged<Page>("https://x/p?n=1", next, { fetch: serve(10), maxPages: 3 }, new Deadline(5_000));
    expect(r).toMatchObject({ complete: false, truncatedBy: "page_budget" });
    expect(r!.pages).toHaveLength(3);
  });

  it("reports completion when the source runs out", async () => {
    const r = await getPaged<Page>("https://x/p?n=1", next, { fetch: serve(2), maxPages: 3 }, new Deadline(5_000));
    expect(r).toMatchObject({ complete: true });
    expect(r!.pages).toHaveLength(2);
  });

  it("keeps what it has when a later page fails", async () => {
    const flaky: FetchLike = async (url) => (url.includes("n=2") ? json({}, 524) : serve(5)(url));
    const r = await getPaged<Page>("https://x/p?n=1", next, { fetch: flaky, maxPages: 3 }, new Deadline(5_000));
    expect(r).toMatchObject({ complete: false, truncatedBy: "error" });
    expect(r!.pages).toHaveLength(1);
  });

  it("stops at the deadline instead of failing the screen", async () => {
    const r = await getPaged<Page>("https://x/p?n=1", next, { fetch: serve(10, 400), maxPages: 10 }, new Deadline(1_000));
    expect(r!.truncatedBy).toBe("deadline");
    expect(r!.pages.length).toBeGreaterThanOrEqual(1);
    expect(r!.pages.length).toBeLessThan(10);
  });

  it("fails when the first page fails", async () => {
    await expect(getPaged<Page>("https://x/p?n=1", next, { fetch: async () => json({}, 500), maxPages: 3 }, new Deadline(1_000))).rejects.toThrow();
  });
});

describe("adapters request what they should", () => {
  it("Horizon asks for successful operations only and follows _links.next on the configured host", async () => {
    const urls: string[] = [];
    const records = (n: number) => Array.from({ length: n }, (_, i) => payment({ id: String(i), transaction: { memo_type: "none" } }));
    const fetch: FetchLike = async (url) => {
      urls.push(url);
      if (url.endsWith(`/accounts/${H}`)) return json({ account_id: H, flags: { auth_required: false, auth_revocable: false, auth_clawback_enabled: false }, balances: [] });
      if (url.includes("/payments")) {
        const second = url.includes("cursor=");
        return json({ _links: { next: { href: `https://internal-horizon:8000/accounts/${H}/payments?cursor=9&include_failed=false&join=transactions&limit=200&order=desc` } }, _embedded: { records: records(second ? 3 : 200) } });
      }
      return json({ _embedded: { records: [] } });
    };
    const data = await fetchStellarAccount(H, { fetch, horizonUrl: "https://my-horizon.example" });
    const payments = urls.filter((u) => u.includes("/payments"));
    expect(payments).toHaveLength(2);
    expect(payments[0]).toContain("include_failed=false");
    expect(payments[1]).toBe(`https://my-horizon.example/accounts/${H}/payments?cursor=9&include_failed=false&join=transactions&limit=200&order=desc`);
    expect(urls.find((u) => u.includes("/operations?"))).toContain("include_failed=false");
    expect(data.profile.window).toMatchObject({ pages: { payments: 2 }, records: 203 });
  });

  it("Blockscout follows next_page_params up to the budget", async () => {
    const urls: string[] = [];
    const fetch: FetchLike = async (url) => {
      urls.push(url);
      if (/addresses\/0x[0-9a-fA-F]+$/.test(url)) return json({ hash: "0x1", coin_balance: "0", is_contract: false, ens_domain_name: null });
      return json({ items: [], next_page_params: { block_number: 5, index: 2 } });
    };
    const data = await fetchEvmAccount("evm:1", "0x1111111111111111111111111111111111111111", { fetch });
    expect(urls.filter((u) => u.includes("/transactions"))).toEqual([
      "https://eth.blockscout.com/api/v2/addresses/0x1111111111111111111111111111111111111111/transactions",
      "https://eth.blockscout.com/api/v2/addresses/0x1111111111111111111111111111111111111111/transactions?block_number=5&index=2",
    ]);
    expect(data.profile.fullHistory).toBe(false);
    expect(data.profile.window?.truncatedBy).toBe("page_budget");
  });
});

describe("getJson retries", () => {
  it("retries a transient 503 or connection reset once, but not a 500", async () => {
    const { getJson } = await import("./http");
    let calls = 0;
    const flaky: FetchLike = async () => (++calls === 1 ? json({}, 503) : json({ ok: true }));
    expect(await getJson("https://x/a", { fetch: flaky })).toEqual({ ok: true });
    expect(calls).toBe(2);

    calls = 0;
    const reset: FetchLike = async () => {
      if (++calls === 1) throw new TypeError("fetch failed");
      return json({ ok: 1 });
    };
    expect(await getJson("https://x/a", { fetch: reset })).toEqual({ ok: 1 });

    calls = 0;
    const broken: FetchLike = async () => (++calls, json({}, 500));
    await expect(getJson("https://x/a", { fetch: broken })).rejects.toThrow("responded 500");
    expect(calls).toBe(1);
  });
});
