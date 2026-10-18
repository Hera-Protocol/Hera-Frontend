import type { ReportDto } from "@hera/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, json, mockFetch, UUID } from "./helpers";

const report = (status: ReportDto["status"], extra: Partial<ReportDto> = {}): ReportDto => ({
  id: UUID,
  reference: "RPT-2026Q4-7KX2",
  type: "screening_evidence",
  title: "Screening evidence",
  status,
  requestedBy: "ops@example.com",
  createdAt: "2026-10-18T00:00:00.000Z",
  ...extra,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("reports.waitUntilReady", () => {
  it("polls until ready", async () => {
    const { fetch, calls } = mockFetch(json(report("queued")), json(report("rendering")), json(report("ready", { pdfSha256: "ab" })));
    const promise = client(fetch).reports.waitUntilReady(UUID, { intervalMs: 500 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toMatchObject({ status: "ready", pdfSha256: "ab" });
    expect(calls).toHaveLength(3);
  });

  it("throws report_failed with the server's error", async () => {
    const { fetch } = mockFetch(json(report("failed", { error: "Template crashed" })));
    await expect(client(fetch).reports.waitUntilReady(UUID)).rejects.toMatchObject({ code: "report_failed", message: "Template crashed" });
  });

  it("throws report_timeout when it doesn't finish in time", async () => {
    const { fetch } = mockFetch(json(report("rendering")));
    const promise = client(fetch).reports.waitUntilReady(UUID, { timeoutMs: 2000, intervalMs: 500 }).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(await promise).toMatchObject({ code: "report_timeout" });
  });
});
