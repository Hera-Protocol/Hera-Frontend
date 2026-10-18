import { describe, expect, it } from "vitest";
import { createLabelIndex, SEED_LABELS } from "./labels";
import { scoreSubject, transfersForSubject } from "./risk";
import type { SubjectProfile, SubjectRef, Transfer } from "./types";

const NOW = new Date("2026-10-18T12:00:00Z");
const labels = createLabelIndex(SEED_LABELS);
const SANCTIONED = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";
const MIXER = "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b";
const ME = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

const evmSubject = (address: string): SubjectRef => ({ chain: "evm:1", address: address as `0x${string}` });
const profile = (over: Partial<SubjectProfile> = {}): SubjectProfile => ({ exists: true, observedTransfers: 0, fullHistory: false, ...over });

let n = 0;
function tx(from: string, to: string, amount: string, at: string, asset = "ETH", extra: Partial<Transfer> = {}): Transfer {
  n++;
  return {
    id: `t${n}`,
    chain: "evm:1",
    txHash: `0x${n.toString(16).padStart(64, "0")}`,
    timestamp: at,
    kind: "native",
    from: { address: from },
    to: { address: to },
    asset: { code: asset, decimals: 18 },
    amount,
    successful: true,
    ...extra,
  };
}

describe("scoreSubject", () => {
  it("blocks a directly sanctioned address at 100", () => {
    const r = scoreSubject({ subject: evmSubject(SANCTIONED), profile: profile(), transfers: [], labels, now: NOW });
    expect(r.score).toBe(100);
    expect(r.decision).toBe("block");
    expect(r.reasons[0]!.code).toBe("SANCTIONS_DIRECT");
  });

  it("matches labels case-insensitively on EVM", () => {
    const r = scoreSubject({ subject: evmSubject(SANCTIONED.toLowerCase()), profile: profile(), transfers: [], labels, now: NOW });
    expect(r.score).toBe(100);
  });

  it("scores a clean, quiet wallet low", () => {
    const transfers = [tx(OTHER, ME, "1", "2026-10-01T00:00:00Z"), tx(ME, OTHER, "0.5", "2026-10-02T00:00:00Z")];
    const r = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers, labels, now: NOW });
    expect(r.band).toBe("low");
    expect(r.decision).toBe("allow");
  });

  it("raises exposure when a counterparty is sanctioned, scaled by share", () => {
    const one = [tx(SANCTIONED, ME, "1", "2026-10-01T00:00:00Z"), ...Array.from({ length: 19 }, (_, i) => tx(OTHER, ME, "1", `2026-10-0${(i % 9) + 1}T01:00:00Z`))];
    const light = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers: one, labels, now: NOW });
    const heavy = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers: [tx(SANCTIONED, ME, "1", "2026-10-01T00:00:00Z")], labels, now: NOW });
    expect(light.reasons.some((r) => r.code === "COUNTERPARTY_EXPOSURE")).toBe(true);
    expect(light.score).toBeGreaterThanOrEqual(25);
    expect(heavy.score).toBeGreaterThan(light.score);
    expect(heavy.band).toBe("severe");
  });

  it("flags mixer withdrawals", () => {
    const r = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers: [tx(MIXER, ME, "10", "2026-10-10T00:00:00Z")], labels, now: NOW });
    expect(r.reasons[0]!.code).toBe("COUNTERPARTY_EXPOSURE");
    expect(r.decision).not.toBe("allow");
  });

  it("detects structuring just under $10k within 24h", () => {
    const usdc = { code: "USDC", issuer: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 };
    const transfers = ["9500", "9800", "9900"].map((amt, i) => tx(OTHER, ME, amt, `2026-10-17T0${i}:00:00Z`, "USDC", { kind: "erc20", asset: usdc }));
    const r = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers, labels, now: NOW });
    expect(r.reasons.map((x) => x.code)).toContain("STRUCTURING");
  });

  it("does not treat a spam token called USDC as dollars", () => {
    const fake = { code: "USDC", issuer: "0x3333333333333333333333333333333333333333", decimals: 6 };
    const transfers = ["9500", "9800", "9900"].map((amt, i) => tx(OTHER, ME, amt, `2026-10-17T0${i}:00:00Z`, "USDC", { kind: "erc20", asset: fake }));
    const r = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers, labels, now: NOW });
    expect(r.reasons.map((x) => x.code)).not.toContain("STRUCTURING");
  });

  it("detects rapid in-out pass-through", () => {
    const transfers = [0, 1, 2].flatMap((h) => [
      tx(OTHER, ME, "100", `2026-10-17T0${h}:00:00Z`, "USDC"),
      tx(ME, OTHER, "99", `2026-10-17T0${h}:20:00Z`, "USDC"),
    ]);
    const r = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers, labels, now: NOW });
    expect(r.reasons.map((x) => x.code)).toContain("RAPID_IN_OUT");
  });

  it("only flags fresh accounts when creation was observed", () => {
    const fresh = scoreSubject({ subject: evmSubject(ME), profile: profile({ createdAt: "2026-10-17T00:00:00Z" }), transfers: [], labels, now: NOW });
    const unknown = scoreSubject({ subject: evmSubject(ME), profile: profile({ firstSeen: "2026-10-17T00:00:00Z" }), transfers: [], labels, now: NOW });
    expect(fresh.reasons.map((x) => x.code)).toContain("FRESH_ACCOUNT");
    expect(unknown.reasons.map((x) => x.code)).not.toContain("FRESH_ACCOUNT");
  });
});

describe("Stellar sub-accounts", () => {
  const OMNIBUS = "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM";
  const SENDER = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
  const stx = (muxedId: string | undefined, memo?: string): Transfer => ({
    ...tx(SENDER, OMNIBUS, "50", "2026-10-15T00:00:00Z", "USDC"),
    chain: "stellar",
    kind: "payment",
    to: { address: OMNIBUS, muxedId },
    memo: memo ? { type: "id", value: memo } : undefined,
  });
  const transfers = [stx("42"), stx("42"), stx("7"), stx(undefined, "1001"), stx("5"), stx("6"), ...Array.from({ length: 8 }, () => stx("9"))];

  it("narrows to the muxed id", () => {
    const view = transfersForSubject({ chain: "stellar", account: OMNIBUS, sub: { kind: "muxed", id: "42", muxed: "M…" } }, transfers);
    expect(view).toHaveLength(2);
  });

  it("narrows to the memo", () => {
    const view = transfersForSubject({ chain: "stellar", account: OMNIBUS, sub: { kind: "memo", type: "id", value: "1001" } }, transfers);
    expect(view).toHaveLength(1);
  });

  it("warns when an omnibus account is screened without a sub-account", () => {
    const r = scoreSubject({
      subject: { chain: "stellar", account: OMNIBUS },
      profile: profile({ sharedAccountRatio: 1 }),
      transfers,
      labels,
      now: NOW,
    });
    expect(r.reasons.map((x) => x.code)).toContain("SHARED_ACCOUNT_NO_SUBACCOUNT");
  });

  it("does not penalize an unavailable toml, but does penalize an unlisted one", () => {
    const base = { subject: { chain: "stellar" as const, account: SENDER }, transfers: [], labels, now: NOW };
    const unavailable = scoreSubject({ ...base, profile: profile({ homeDomain: "x.com", toml: { domain: "x.com", status: "unavailable", seps: [] } }) });
    const unlisted = scoreSubject({ ...base, profile: profile({ homeDomain: "x.com", toml: { domain: "x.com", status: "unlisted", seps: ["SEP-1"] } }) });
    expect(unavailable.reasons.map((x) => x.code)).not.toContain("UNVERIFIED_HOME_DOMAIN");
    expect(unlisted.reasons.map((x) => x.code)).toContain("UNVERIFIED_HOME_DOMAIN");
  });
});

describe("hardening regressions", () => {
  const PEER = "0x3333333333333333333333333333333333333333";

  it("contact with a sanctioned party never dilutes mixer exposure (old formula: 64 → 63)", () => {
    const base = [
      ...Array.from({ length: 20 }, (_, i) => tx(MIXER, ME, "1", `2026-10-0${(i % 9) + 1}T02:00:00Z`)),
      ...Array.from({ length: 80 }, (_, i) => tx(OTHER, ME, "1", `2026-10-0${(i % 9) + 1}T03:00:00Z`)),
    ];
    const before = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers: base, labels, now: NOW });
    const after = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers: [...base, tx(SANCTIONED, ME, "1", "2026-10-05T00:00:00Z")], labels, now: NOW });
    expect(before.score).toBe(64);
    expect(after.score).toBeGreaterThanOrEqual(before.score);
  });

  it("ignores self-transfers in behavior and exposure", () => {
    const selfies = [0, 1, 2, 3].map((h) => tx(ME, ME, "100", `2026-10-17T0${h}:00:00Z`));
    const r = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers: selfies, labels, now: NOW });
    expect(r.reasons.map((x) => x.code)).not.toContain("RAPID_IN_OUT");
    expect(r.counterparties).toHaveLength(0);
    expect(r.reasons.map((x) => x.code)).toContain("NO_HISTORY");
  });

  it("matches pass-through one-to-one: one big withdrawal does not explain many deposits", () => {
    const deposits = [0, 1, 2, 3, 4].map((m) => tx(OTHER, ME, "100", `2026-10-17T01:0${m}:00Z`, "USDC"));
    const oneOut = [tx(ME, PEER, "100", "2026-10-17T01:30:00Z", "USDC")];
    const r = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers: [...deposits, ...oneOut], labels, now: NOW });
    expect(r.reasons.map((x) => x.code)).not.toContain("RAPID_IN_OUT");
  });

  it("treats a payment between two muxed customers of one account as an outflow, not a self-transfer", () => {
    const OMNI = "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM";
    const t: Transfer = { ...tx(OMNI, OMNI, "5", "2026-10-10T00:00:00Z"), chain: "stellar", kind: "payment", from: { address: OMNI, muxedId: "42" }, to: { address: OMNI, muxedId: "7" } };
    const r = scoreSubject({ subject: { chain: "stellar", account: OMNI, sub: { kind: "muxed", id: "42", muxed: "M…" } }, profile: profile(), transfers: [t], labels, now: NOW });
    expect(r.stats).toMatchObject({ transfers: 1, inbound: 0, outbound: 1 });
    expect(r.counterparties).toEqual([expect.objectContaining({ address: OMNI, muxedId: "7", outbound: 1 })]);
  });

  it("does not score a failed transfer to a sanctioned address, but says so", () => {
    const failed = tx(ME, SANCTIONED, "1", "2026-10-10T00:00:00Z", "ETH", { successful: false });
    const ok = tx(OTHER, ME, "1", "2026-10-09T00:00:00Z");
    const r = scoreSubject({ subject: evmSubject(ME), profile: profile(), transfers: [failed, ok], labels, now: NOW });
    expect(r.band).toBe("low");
    expect(r.stats.failed).toBe(1);
    expect(r.transfers.map((t) => t.id)).toContain(failed.id);
    expect(r.reasons.find((x) => x.code === "FAILED_RISKY_ATTEMPT")).toMatchObject({ points: 0, severity: "info" });
  });

  it("treats EIP-7702 wallets as wallets, and scores a delegate with a risk label", () => {
    const plain = scoreSubject({ subject: evmSubject(ME), profile: profile({ isContract: false, delegatedTo: OTHER }), transfers: [], labels, now: NOW });
    expect(plain.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(["EIP7702_DELEGATED"]));
    expect(plain.reasons.map((x) => x.code)).not.toContain("SMART_CONTRACT");
    const sweeper = scoreSubject({ subject: evmSubject(ME), profile: profile({ isContract: false, delegatedTo: MIXER }), transfers: [], labels, now: NOW });
    expect(sweeper.reasons[0]).toMatchObject({ code: "EIP7702_DELEGATED", points: 64 });
    expect(sweeper.band).toBe("high");
    const contract = scoreSubject({ subject: evmSubject(ME), profile: profile({ isContract: true }), transfers: [], labels, now: NOW });
    expect(contract.reasons.map((x) => x.code)).toContain("SMART_CONTRACT");
  });
});
