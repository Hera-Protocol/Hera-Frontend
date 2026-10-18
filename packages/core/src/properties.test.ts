import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatUnits } from "./amount";
import { createLabelIndex, SEED_LABELS } from "./labels";
import { bandFor, scoreSubject, transfersForSubject } from "./risk";
import {
  decodeEd25519PublicKey,
  decodeMuxedAccount,
  encodeEd25519PublicKey,
  encodeMuxedAccount,
  isValidAccountId,
  isValidMuxedAccount,
} from "./stellar/strkey";
import { parseSubject } from "./subject";
import type { Label, SubjectProfile, SubjectRef, Transfer } from "./types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const MAX_UINT64 = (1n << 64n) - 1n;
const key32 = fc.uint8Array({ minLength: 32, maxLength: 32 });
const uint64 = fc.bigInt({ min: 0n, max: MAX_UINT64 });

describe("strkey properties", () => {
  it("G… round-trips for any 32-byte key", () => {
    fc.assert(
      fc.property(key32, (key) => {
        const g = encodeEd25519PublicKey(key);
        expect(g).toHaveLength(56);
        expect(g[0]).toBe("G");
        expect(decodeEd25519PublicKey(g)).toEqual(key);
      }),
    );
  });

  it("M… round-trips for any key and any uint64 id", () => {
    fc.assert(
      fc.property(key32, uint64, (key, id) => {
        const g = encodeEd25519PublicKey(key);
        const m = encodeMuxedAccount(g, id);
        expect(m).toHaveLength(69);
        expect(decodeMuxedAccount(m)).toEqual({ account: g, id, muxed: m });
      }),
    );
  });

  it("rejects any single-character substitution in a valid G… or M…", () => {
    fc.assert(
      fc.property(
        key32,
        uint64,
        fc.boolean(),
        fc.nat(),
        fc.oneof(fc.constantFrom(...ALPHABET), fc.string({ minLength: 1, maxLength: 1 })),
        (key, id, muxed, pos, replacement) => {
          const g = encodeEd25519PublicKey(key);
          const valid = muxed ? encodeMuxedAccount(g, id) : g;
          const i = pos % valid.length;
          fc.pre(replacement !== valid[i]);
          const corrupted = valid.slice(0, i) + replacement + valid.slice(i + 1);
          expect(isValidAccountId(corrupted)).toBe(false);
          expect(isValidMuxedAccount(corrupted)).toBe(false);
        },
      ),
      { numRuns: 2_000 },
    );
  });
});

describe("parseSubject properties", () => {
  const memo = fc.option(fc.record({ type: fc.constantFrom("id" as const, "text" as const, "hash" as const), value: fc.string() }), { nil: undefined });
  const chain = fc.option(fc.constantFrom("stellar" as const, "evm:1" as const, "evm:8453" as const, "evm:999999" as const), { nil: undefined });
  const address = fc.oneof(
    fc.string(),
    fc.string({ unit: "grapheme" }),
    fc.tuple(fc.constantFrom("G", "M", "0x", "0X", " G", "C"), fc.string()).map(([p, s]) => p + s),
    fc.stringMatching(/^0x[0-9a-fA-F]{40}$/),
    key32.map((k) => encodeEd25519PublicKey(k)),
  );

  it("never throws on arbitrary input", () => {
    fc.assert(
      fc.property(address, memo, chain, (a, m, c) => {
        const r = parseSubject({ address: a, memo: m, chain: c });
        expect(typeof r.ok).toBe("boolean");
        if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
      }),
      { numRuns: 3_000 },
    );
  });

  it("accepts every valid M… and decodes it to the same account and id", () => {
    fc.assert(
      fc.property(key32, uint64, (key, id) => {
        const g = encodeEd25519PublicKey(key);
        const r = parseSubject({ address: encodeMuxedAccount(g, id) });
        expect(r.ok && r.subject.chain === "stellar" && r.subject.account === g && r.subject.sub?.kind === "muxed" && r.subject.sub.id === id.toString()).toBe(true);
      }),
    );
  });
});

describe("formatUnits", () => {
  it("agrees with BigInt arithmetic", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 40n), max: 10n ** 40n }), fc.integer({ min: 0, max: 36 }), (value, decimals) => {
        const out = formatUnits(value.toString(), decimals);
        const scale = 10n ** BigInt(decimals);
        const abs = value < 0n ? -value : value;
        const whole = (abs / scale).toString();
        const fraction = decimals ? (abs % scale).toString().padStart(decimals, "0").replace(/0+$/, "") : "";
        const expected = `${value < 0n ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
        expect(out).toBe(expected);
        // And back again: the decimal string denotes exactly value / 10^decimals.
        const [w, f = ""] = out.replace("-", "").split(".");
        const back = BigInt(w!) * scale + BigInt(f.padEnd(decimals, "0") || "0");
        expect(out.startsWith("-") ? -back : back).toBe(value);
      }),
      { numRuns: 2_000 },
    );
  });
});

/* ─── Risk engine invariants ─────────────────────────── */

const NOW = new Date("2026-10-18T12:00:00Z");
const SANCTIONED = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";
const MIXER = "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b";
const EXCHANGE = "0x28C6c06298d514Db089934071355E5743bf21d60";
const ME = "0x1111111111111111111111111111111111111111";
const PEERS = ["0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333", "0x4444444444444444444444444444444444444444"];
const SCAM = "0x5555555555555555555555555555555555555555";
const STOLEN = "0x6666666666666666666666666666666666666666";
const USDC = { code: "USDC", issuer: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 };

const extraLabels: Label[] = [
  { chain: "evm:1", address: SCAM, category: "scam", entity: "Test scam", source: "test", confidence: 1, addedAt: "2026-01-01" },
  { chain: "evm:1", address: STOLEN, category: "stolen_funds", entity: "Test exploit", source: "test", confidence: 1, addedAt: "2026-01-01" },
  { chain: "evm:1", address: PEERS[2]!, category: "gambling", entity: "Test casino", source: "test", confidence: 1, addedAt: "2026-01-01" },
];
const labels = createLabelIndex([...SEED_LABELS, ...extraLabels]);

const counterparty = fc.constantFrom(...PEERS, SANCTIONED, MIXER, EXCHANGE, SCAM, STOLEN, ME);
const timestamp = fc.integer({ min: 0, max: 30 * 24 * 60 }).map((minutesAgo) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString());
const amount = fc.oneof(fc.constantFrom("9500", "9900", "2800", "100", "99", "0.5"), fc.integer({ min: 1, max: 20_000 }).map(String));

function evmTransfer(id: number, other: string, inbound: boolean, at: string, amt: string, usdc: boolean, successful: boolean): Transfer {
  return {
    id: `t${id}`,
    chain: "evm:1",
    txHash: `0x${id.toString(16).padStart(64, "0")}`,
    timestamp: at,
    kind: usdc ? "erc20" : "native",
    from: { address: inbound ? other : ME },
    to: { address: inbound ? ME : other },
    asset: usdc ? USDC : { code: "ETH", decimals: 18 },
    amount: amt,
    successful,
  };
}

const transferSpec = fc.record({
  other: counterparty,
  inbound: fc.boolean(),
  at: timestamp,
  amount,
  usdc: fc.boolean(),
  successful: fc.integer({ min: 0, max: 99 }).map((n) => n < 85),
});
const transferList = fc.array(transferSpec, { maxLength: 60 }).map((specs) =>
  specs.map((s, i) => evmTransfer(i, s.other, s.inbound, s.at, s.amount, s.usdc, s.successful)),
);
const profileArb: fc.Arbitrary<SubjectProfile> = fc.record({
  exists: fc.integer({ min: 0, max: 9 }).map((n) => n > 0),
  observedTransfers: fc.nat({ max: 100 }),
  fullHistory: fc.boolean(),
  createdAt: fc.option(timestamp, { nil: undefined }),
  isContract: fc.option(fc.boolean(), { nil: undefined }),
});
const subject: SubjectRef = { chain: "evm:1", address: ME };

describe("risk invariants", () => {
  it("score is always in [0, 100] and band/decision follow from it", () => {
    fc.assert(
      fc.property(transferList, profileArb, (transfers, profile) => {
        const r = scoreSubject({ subject, profile, transfers, labels, now: NOW });
        expect(Number.isInteger(r.score)).toBe(true);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
        expect(r.band).toBe(bandFor(r.score));
        expect(r.stats.inbound + r.stats.outbound).toBe(r.stats.transfers);
        expect(r.stats.failed).toBe(transfers.filter((t) => !t.successful).length);
      }),
    );
  });

  it("a sanctioned subject always scores 100 and is blocked", () => {
    fc.assert(
      fc.property(transferList, profileArb, (transfers, profile) => {
        const swapped = transfers.map((t) => ({
          ...t,
          from: { address: t.from.address === ME ? SANCTIONED : t.from.address },
          to: { address: t.to.address === ME ? SANCTIONED : t.to.address },
        }));
        const r = scoreSubject({ subject: { chain: "evm:1", address: SANCTIONED }, profile, transfers: swapped, labels, now: NOW });
        expect(r.score).toBe(100);
        expect(r.decision).toBe("block");
      }),
    );
  });

  it("adding a transfer with a sanctioned counterparty never lowers the score", () => {
    fc.assert(
      fc.property(transferList, profileArb, transferSpec, (transfers, profile, extra) => {
        const before = scoreSubject({ subject, profile, transfers, labels, now: NOW });
        const added = evmTransfer(10_000, SANCTIONED, extra.inbound, extra.at, extra.amount, extra.usdc, extra.successful);
        const after = scoreSubject({ subject, profile, transfers: [...transfers, added], labels, now: NOW });
        expect(after.score).toBeGreaterThanOrEqual(before.score);
      }),
      { numRuns: 500 },
    );
  });

  it("failed transfers never change the score", () => {
    fc.assert(
      fc.property(transferList, profileArb, transferSpec, (transfers, profile, extra) => {
        const before = scoreSubject({ subject, profile, transfers, labels, now: NOW });
        const failed = evmTransfer(10_001, extra.other, extra.inbound, extra.at, extra.amount, extra.usdc, false);
        const after = scoreSubject({ subject, profile, transfers: [...transfers, failed], labels, now: NOW });
        expect(after.score).toBe(before.score);
      }),
    );
  });

  it("same input gives the same output, whatever the input order", () => {
    fc.assert(
      fc.property(
        transferList.chain((ts) => fc.tuple(fc.constant(ts), fc.shuffledSubarray(ts, { minLength: ts.length, maxLength: ts.length }))),
        profileArb,
        ([transfers, shuffled], profile) => {
          const a = scoreSubject({ subject, profile, transfers, labels, now: NOW });
          const b = scoreSubject({ subject, profile, transfers, labels, now: NOW });
          const c = scoreSubject({ subject, profile, transfers: shuffled, labels, now: NOW });
          expect(b).toEqual(a);
          expect(c).toEqual(a);
        },
      ),
    );
  });
});

describe("Stellar sub-account views", () => {
  const OMNIBUS = "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM";
  const OTHERS = ["GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"];
  const party = fc.oneof(
    fc.record({ address: fc.constant(OMNIBUS), muxedId: fc.option(fc.constantFrom("1", "2", "3"), { nil: undefined }) }),
    fc.record({ address: fc.constantFrom(...OTHERS) }),
  );
  const memo = fc.option(
    fc.oneof(fc.record({ type: fc.constant("id"), value: fc.constantFrom("1", "2", "77") }), fc.record({ type: fc.constant("text"), value: fc.constantFrom("a", "1") })),
    { nil: undefined },
  );
  const stellarTransfers = fc.array(fc.record({ from: party, to: party, memo, at: timestamp, successful: fc.boolean() }), { maxLength: 60 }).map((xs) =>
    xs.map((x, i): Transfer => ({
      id: `s${i}`, chain: "stellar", txHash: `h${i}`, timestamp: x.at, kind: "payment", from: x.from, to: x.to,
      asset: { code: "XLM", decimals: 7 }, amount: "10", memo: x.memo, successful: x.successful,
    })),
  );
  const sub = fc.oneof(
    fc.constantFrom("1", "2", "3").map((id): SubjectRef => ({ chain: "stellar", account: OMNIBUS, sub: { kind: "muxed", id, muxed: encodeMuxedAccount(OMNIBUS, BigInt(id)) } })),
    fc.constantFrom("1", "2", "77").map((value): SubjectRef => ({ chain: "stellar", account: OMNIBUS, sub: { kind: "memo", type: "id", value } })),
  );

  it("a muxed or memo view is a subset of the base view, and scoring it never throws", () => {
    fc.assert(
      fc.property(stellarTransfers, sub, (transfers, subject) => {
        const base = new Set(transfersForSubject({ chain: "stellar", account: OMNIBUS }, transfers).map((t) => t.id));
        const view = transfersForSubject(subject, transfers);
        for (const t of view) expect(base.has(t.id)).toBe(true);
        const r = scoreSubject({ subject, profile: { exists: true, observedTransfers: transfers.length, fullHistory: false }, transfers, labels, now: NOW });
        expect(r.stats.transfers).toBe(view.length);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }),
    );
  });
});
