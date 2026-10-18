/**
 * Golden tests: real Horizon and Blockscout responses (recorded by
 * scripts/record-fixtures.ts, trimmed to the fields the adapters read) are
 * served through an injected fetch, then normalized and scored with `now`
 * fixed to the recording time. Everything here is deterministic and offline.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchStellarAccount } from "./adapters/horizon";
import type { FetchLike } from "./adapters/http";
import { createLabelIndex, SEED_LABELS } from "./labels";
import { scoreSubject, transfersForSubject } from "./risk";
import { screenSubject } from "./screen";
import { encodeMuxedAccount } from "./stellar/strkey";
import { parseSubject } from "./subject";
import type { ScreeningResult, SubjectRef } from "./types";

interface Fixture {
  name: string;
  address: string;
  recordedAt: string;
  responses: Record<string, { status: number; json?: unknown; text?: string }>;
}

const load = (name: string): Fixture => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"));

function fixtureFetch(fixture: Fixture): FetchLike {
  return async (url) => {
    const hit = fixture.responses[url];
    if (!hit) throw new Error(`Unrecorded request in fixture ${fixture.name}: ${url}`);
    return hit.json !== undefined
      ? new Response(JSON.stringify(hit.json), { status: hit.status, headers: { "content-type": "application/json" } })
      : new Response(hit.text ?? "", { status: hit.status });
  };
}

const labels = createLabelIndex(SEED_LABELS);

function subjectOf(address: string, memo?: { type: "id" | "text" | "hash"; value: string }): SubjectRef {
  const parsed = parseSubject({ address, memo });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.subject;
}

async function screen(name: string, subject?: SubjectRef): Promise<ScreeningResult> {
  const fixture = load(name);
  return screenSubject(subject ?? subjectOf(fixture.address), {
    labels,
    fetch: fixtureFetch(fixture),
    now: new Date(fixture.recordedAt),
  });
}

/** What the snapshot pins: the decision and every reason, plus the shape of the data behind it. */
function golden(r: ScreeningResult) {
  return {
    score: r.score,
    band: r.band,
    decision: r.decision,
    reasons: r.reasons.map((x) => `${x.code} +${x.points} ${x.severity}: ${x.detail}`),
    stats: r.stats,
    profile: {
      exists: r.profile.exists,
      createdAt: r.profile.createdAt,
      fullHistory: r.profile.fullHistory,
      observedTransfers: r.profile.observedTransfers,
      isContract: r.profile.isContract,
      delegatedTo: r.profile.delegatedTo,
      sharedAccountRatio: r.profile.sharedAccountRatio,
      window: r.profile.window,
      dataStatus: r.profile.dataStatus,
    },
    counterparties: r.counterparties.length,
    newestTransfers: r.transfers.slice(0, 3).map((t) => t.id),
    engineVersion: r.engineVersion,
  };
}

const codes = (r: ScreeningResult) => r.reasons.map((x) => x.code);

const KRAKEN = "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM";
const KRAKEN_MUXED_ID = "1790254030022811771";
const KRAKEN_MEMO = "1763579285836133015";

describe("golden: Circle USDC issuer (Stellar)", () => {
  it("is a known issuer, not a shared customer account", async () => {
    const r = await screen("circle-usdc-issuer");
    expect(codes(r)).toContain("KNOWN_ENTITY");
    expect(codes(r)).not.toContain("SHARED_ACCOUNT_NO_SUBACCOUNT");
    expect(r.decision).toBe("allow");
    expect(r.score).toBeLessThanOrEqual(5);
    // Paged three times through _links.next, then stopped on the budget.
    expect(r.profile.window).toMatchObject({ pages: { payments: 3 }, truncatedBy: "page_budget" });
    expect(r.profile.fullHistory).toBe(false);
    expect(r.stats.transfers).toBeGreaterThan(200);
    expect(golden(r)).toMatchSnapshot();
  });
});

describe("golden: Kraken omnibus (Stellar, muxed and memo routing)", () => {
  it("warns at the base account and does not call deposit traffic a pass-through", async () => {
    const r = await screen("kraken");
    expect(codes(r)).toContain("SHARED_ACCOUNT_NO_SUBACCOUNT");
    expect(codes(r)).not.toContain("RAPID_IN_OUT");
    expect(r.decision).toBe("allow");
    expect(golden(r)).toMatchSnapshot();
  });

  it("narrows to one muxed customer", async () => {
    const muxed = encodeMuxedAccount(KRAKEN, BigInt(KRAKEN_MUXED_ID));
    const r = await screen("kraken", subjectOf(muxed));
    expect(codes(r)).toContain("SUBACCOUNT_RESOLVED");
    expect(codes(r)).not.toContain("SHARED_ACCOUNT_NO_SUBACCOUNT");
    expect(r.stats.transfers).toBeGreaterThan(0);
    for (const t of r.transfers) expect(t.to.muxedId === KRAKEN_MUXED_ID || t.from.muxedId === KRAKEN_MUXED_ID).toBe(true);
    expect(golden(r)).toMatchSnapshot();
  });

  it("narrows to one memo customer, inbound only", async () => {
    const r = await screen("kraken", subjectOf(KRAKEN, { type: "id", value: KRAKEN_MEMO }));
    expect(codes(r)).toContain("SUBACCOUNT_RESOLVED");
    expect(r.stats.transfers).toBeGreaterThan(0);
    expect(r.stats.outbound).toBe(0);
    for (const t of r.transfers) expect(t.memo).toEqual({ type: "id", value: KRAKEN_MEMO });
    expect(golden(r)).toMatchSnapshot();
  });

  it("gives the same memo view for a zero-padded memo id", async () => {
    const a = await screen("kraken", subjectOf(KRAKEN, { type: "id", value: KRAKEN_MEMO }));
    const b = await screen("kraken", subjectOf(KRAKEN, { type: "id", value: `000${KRAKEN_MEMO}` }));
    expect(b.stats).toEqual(a.stats);
  });
});

describe("golden: claimable-balance claimant (Stellar)", () => {
  it("turns claims into transfers from the creator", async () => {
    const r = await screen("cb-claimant");
    const claims = r.transfers.filter((t) => t.kind === "claim");
    expect(claims.length).toBeGreaterThan(0);
    expect(r.profile.window?.claimsResolved).toBe(claims.length);
    for (const c of claims) {
      expect(c.to.address).toBe(r.subject.chain === "stellar" ? r.subject.account : "");
      expect(c.from.address).not.toBe(c.to.address);
      expect(Number(c.amount)).toBeGreaterThan(0);
    }
    expect(golden(r)).toMatchSnapshot();
  });
});

describe("golden: vitalik.eth (EIP-7702 delegated EOA)", () => {
  it("is a wallet with a delegate, not a smart contract", async () => {
    const r = await screen("vitalik");
    expect(r.profile.isContract).toBe(false);
    expect(r.profile.delegatedTo).toBe("0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d");
    expect(codes(r)).toContain("EIP7702_DELEGATED");
    expect(codes(r)).not.toContain("SMART_CONTRACT");
    expect(r.decision).toBe("allow");
    expect(golden(r)).toMatchSnapshot();
  });
});

describe("golden: OFAC-listed Lazarus address", () => {
  it("is blocked at 100", async () => {
    const r = await screen("ofac-lazarus");
    expect(r.score).toBe(100);
    expect(r.decision).toBe("block");
    expect(r.reasons[0]!.code).toBe("SANCTIONS_DIRECT");
    expect(golden(r)).toMatchSnapshot();
  });
});

describe("golden: address with failed transactions", () => {
  it("keeps failed transfers for display but never scores them", async () => {
    const r = await screen("failed-txs");
    expect(r.stats.failed).toBeGreaterThanOrEqual(50);
    expect(r.transfers.some((t) => !t.successful)).toBe(true);
    expect(codes(r)).not.toContain("HIGH_VELOCITY");
    expect(r.band).toBe("low");
    expect(golden(r)).toMatchSnapshot();
  });

  it("would have fired HIGH_VELOCITY had the failures counted (what the fix changed)", async () => {
    const r = await screen("failed-txs");
    const pretend = scoreSubject({
      subject: r.subject,
      profile: r.profile,
      transfers: r.transfers.map((t) => ({ ...t, successful: true })),
      labels,
      now: new Date(load("failed-txs").recordedAt),
    });
    expect(codes(pretend)).toContain("HIGH_VELOCITY");
  });
});

describe("golden: invariants across every fixture", () => {
  const names = ["circle-usdc-issuer", "kraken", "cb-claimant", "vitalik", "ofac-lazarus", "failed-txs"];

  it.each(names)("%s is deterministic and in range", async (name) => {
    const a = await screen(name);
    const b = await screen(name);
    expect(b).toEqual(a);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.stats.inbound + a.stats.outbound).toBe(a.stats.transfers);
    // Newest first.
    const times = a.transfers.map((t) => Date.parse(t.timestamp));
    expect(times).toEqual([...times].sort((x, y) => y - x));
  });

  it("muxed and memo views are subsets of the base view", async () => {
    const data = await fetchStellarAccount(KRAKEN, { fetch: fixtureFetch(load("kraken")) });
    const ids = new Set(data.transfers.map((t) => t.id));
    for (const sub of [subjectOf(encodeMuxedAccount(KRAKEN, BigInt(KRAKEN_MUXED_ID))), subjectOf(KRAKEN, { type: "id", value: KRAKEN_MEMO })]) {
      const view = transfersForSubject(sub, data.transfers);
      expect(view.length).toBeGreaterThan(0);
      for (const t of view) expect(ids.has(t.id)).toBe(true);
    }
  });
});
