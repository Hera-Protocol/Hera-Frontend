import { getAddress } from "viem";
import type { FetchFn, ScreeningResponse, SubjectInput } from "@hera/sdk";

/** OFAC-designated Tornado Cash router, also in Hera's own label set. */
const SANCTIONED = new Set(["0x098b716b8aaf21512996dc57eb0615e2383e2f96"]);

/**
 * Offline demo only: a stand-in for the Hera API so the example runs without an
 * account. The SDK's EIP-55 validation is real; these results are made up.
 */
export function createDemoFetch(): FetchFn {
  return async (_url, init) => {
    const input = JSON.parse(String(init?.body)) as SubjectInput;
    const address = getAddress(input.address);
    const hit = SANCTIONED.has(address.toLowerCase());
    const body: ScreeningResponse = {
      id: crypto.randomUUID(),
      subject: { chain: (input.chain ?? "evm:1") as `evm:${number}`, address },
      display: address,
      score: hit ? 100 : 6,
      band: hit ? "severe" : "low",
      decision: hit ? "block" : "allow",
      reasons: hit
        ? [{ code: "SANCTIONS_DIRECT", points: 100, severity: "critical", title: "Sanctioned address (OFAC SDN)", detail: "Tornado Cash router, designated 2022-08-08." }]
        : [{ code: "KNOWN_ENTITY", points: 0, severity: "info", title: "No risk labels", detail: "" }],
      profile: { exists: true, observedTransfers: 50, fullHistory: false },
      counterparties: [],
      transfers: [],
      stats: { transfers: 50, inbound: 30, outbound: 20, dustFiltered: 0 },
      screenedAt: new Date().toISOString(),
      engineVersion: "demo",
    };
    return Response.json(body);
  };
}
