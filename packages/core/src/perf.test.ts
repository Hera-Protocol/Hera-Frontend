import { describe, expect, it } from "vitest";
import { createLabelIndex, SEED_LABELS } from "./labels";
import { scoreSubject } from "./risk";
import type { Transfer } from "./types";

/**
 * Budget: scoreSubject over 10,000 transfers in under 100 ms. The synthetic set
 * is deliberately hostile: dense in time (every rule's window is crowded), many
 * distinct counterparties, labelled parties mixed in, stablecoin amounts near
 * the structuring thresholds, and both directions in the same asset so the
 * pass-through matcher has real work to do.
 */
const NOW = new Date("2026-10-18T12:00:00Z");
const ME = "0x1111111111111111111111111111111111111111";
const LABELLED = ["0x098B716B8Aaf21512996dC57EB0615e2383E2f96", "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b", "0x28C6c06298d514Db089934071355E5743bf21d60"];
const USDC = { code: "USDC", issuer: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 };

function synthetic(n: number): Transfer[] {
  let seed = 42;
  const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
  return Array.from({ length: n }, (_, i) => {
    const other = i % 97 === 0 ? LABELLED[i % 3]! : `0x${(1000 + Math.floor(rand() * 3000)).toString(16).padStart(40, "0")}`;
    const inbound = rand() < 0.55;
    const usdc = rand() < 0.5;
    return {
      id: `t${i}`,
      chain: "evm:1",
      txHash: `0x${i.toString(16).padStart(64, "0")}`,
      timestamp: new Date(NOW.getTime() - Math.floor(rand() * 3 * 24 * 3600_000)).toISOString(),
      kind: usdc ? "erc20" : "native",
      from: { address: inbound ? other : ME },
      to: { address: inbound ? ME : other },
      asset: usdc ? USDC : { code: "ETH", decimals: 18 },
      amount: usdc && rand() < 0.2 ? String(9_000 + Math.floor(rand() * 999)) : (rand() * 500).toFixed(6),
      successful: rand() > 0.03,
    } satisfies Transfer;
  });
}

describe("performance", () => {
  it("scores 10,000 transfers in under 100 ms", () => {
    const transfers = synthetic(10_000);
    const labels = createLabelIndex(SEED_LABELS);
    const run = () => scoreSubject({ subject: { chain: "evm:1", address: ME }, profile: { exists: true, observedTransfers: 10_000, fullHistory: false }, transfers, labels, now: NOW });

    run(); // warm up the JIT
    run();
    const times: number[] = [];
    let result = run();
    for (let i = 0; i < 7; i++) {
      const start = performance.now();
      result = run();
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)]!;
    console.log(`scoreSubject(10,000 transfers): median ${median.toFixed(1)} ms, min ${times[0]!.toFixed(1)} ms, max ${times.at(-1)!.toFixed(1)} ms`);
    expect(result.stats.transfers).toBe(10_000);
    expect(median).toBeLessThan(100);
  });
});
