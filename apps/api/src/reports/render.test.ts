import { inflateSync } from "node:zlib";
import { ENGINE_VERSION, type ScreeningResult } from "@hera/core";
import { describe, expect, it } from "vitest";
import { buildEvidenceSnapshot, freeze, SNAPSHOT_SCHEMA, type SnapshotHeader } from "./snapshot";
import { renderReportPdf } from "./templates/render";

const header: Omit<SnapshotHeader, "type" | "scope"> = {
  schema: SNAPSHOT_SCHEMA,
  reference: "RPT-202610-TEST",
  title: "Screening evidence: test",
  org: { id: "00000000-0000-4000-8000-000000000000", name: "Acme" },
  generatedAt: "2026-10-18T12:00:00.000Z",
  requestedBy: "Ada (ada@example.com)",
  engineVersion: ENGINE_VERSION,
  verifyUrl: "http://localhost:3000/verify/RPT-202610-TEST",
};

const address = "0x1111111111111111111111111111111111111111" as const;
const result: ScreeningResult = {
  subject: { chain: "evm:1", address },
  display: address,
  score: 62,
  band: "high",
  decision: "review",
  reasons: [
    { code: "EIP7702_DELEGATED", points: 40, severity: "high", title: "Wallet delegates to a known sweeper", detail: "This EOA has set its code to a sweeper via EIP-7702." },
    { code: "FAILED_RISKY_ATTEMPT", points: 20, severity: "medium", title: "Failed transfers with a flagged counterparty", detail: "Two reverted attempts.", evidence: { txHashes: [`0x${"cd".repeat(32)}`] } },
  ],
  profile: {
    exists: true,
    observedTransfers: 2,
    fullHistory: false,
    delegatedTo: "0x2222222222222222222222222222222222222222",
    window: { pages: { transactions: 2, transfers: 1 }, records: 150, truncatedBy: "page_budget", oldest: "2026-09-01T00:00:00.000Z" },
  },
  counterparties: [],
  transfers: [
    { id: "1", chain: "evm:1", txHash: `0x${"ab".repeat(32)}`, timestamp: "2026-10-01T00:00:00.000Z", kind: "claim", from: { address: "0x3333333333333333333333333333333333333333" }, to: { address }, asset: { code: "ETH", decimals: 18 }, amount: "1.5", successful: true },
    { id: "2", chain: "evm:1", txHash: `0x${"cd".repeat(32)}`, timestamp: "2026-10-02T00:00:00.000Z", kind: "native", from: { address }, to: { address: "0x4444444444444444444444444444444444444444" }, asset: { code: "ETH", decimals: 18 }, amount: "0.1", successful: false },
  ],
  stats: { transfers: 2, inbound: 1, outbound: 1, dustFiltered: 0, failed: 1 },
  screenedAt: "2026-10-18T11:59:00.000Z",
  engineVersion: ENGINE_VERSION,
};

describe("evidence rendering", () => {
  it("carries the new engine fields into the snapshot and renders them", async () => {
    const snapshot = buildEvidenceSnapshot(header, { id: "s-1", createdAt: new Date("2026-10-18T11:59:01Z"), result });
    expect(snapshot.reasons.map((r) => r.code)).toEqual(["EIP7702_DELEGATED", "FAILED_RISKY_ATTEMPT"]);
    expect(snapshot.dataWindow).toMatchObject({ records: 150, truncatedBy: "page_budget", fullHistory: false });
    expect(snapshot.delegatedTo).toBe("0x2222222222222222222222222222222222222222");
    expect(snapshot.transfers.map((t) => t.kind)).toEqual(["native", "claim"]);

    const { sha256 } = freeze(snapshot);
    const pdf = await renderReportPdf(snapshot, sha256);
    // Long enough to span pages, where react-pdf's fixed-element quirks show up.
    const long = { ...snapshot, transfers: Array.from({ length: 150 }, () => snapshot.transfers[0]!) };
    const multiPage = await renderReportPdf(long, sha256);
    expect((multiPage.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThan(2);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
    expect(freeze(snapshot).sha256).toBe(sha256); // canonical JSON is stable

    // Regression: react-pdf once placed the fixed "Page x of y" footer thousands of points below the page.
    const content = [...multiPage.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
      .map((m) => {
        try {
          return inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1");
        } catch {
          return "";
        }
      })
      .join("\n");
    const offsets = [...content.matchAll(/1 0 0 1 -?[\d.]+ (-?[\d.]+) cm/g)].map((m) => Number(m[1]));
    expect(offsets.length).toBeGreaterThan(0);
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(-1);
  });
});
