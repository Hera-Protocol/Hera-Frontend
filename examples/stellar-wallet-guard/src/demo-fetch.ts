import { MuxedAccount } from "@stellar/stellar-sdk";
import type { FetchFn, Reason, ScreeningResponse, SubjectInput, SubjectRef } from "@hera/sdk";

/**
 * Offline demo only: a stand-in for the Hera API so this example runs without
 * an account. The SDK's local validation (checksums, muxed + memo rules) is
 * real; the scores below are made up. Set HERA_API_KEY to screen for real.
 */
export function createDemoFetch(): FetchFn {
  return async (url, init) => {
    if (!url.endsWith("/screen") || init?.method !== "POST") return Response.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 });
    const input = JSON.parse(String(init.body)) as SubjectInput;
    return Response.json(simulate(input));
  };
}

function simulate(input: SubjectInput): ScreeningResponse {
  let subject: SubjectRef;
  let display: string;
  if (input.address.startsWith("M")) {
    const muxed = MuxedAccount.fromAddress(input.address, "0");
    subject = { chain: "stellar", account: muxed.baseAccount().accountId(), sub: { kind: "muxed", id: muxed.id(), muxed: input.address } };
    display = input.address;
  } else if (input.memo) {
    subject = { chain: "stellar", account: input.address, sub: { kind: "memo", type: input.memo.type, value: input.memo.value } };
    display = `${input.address} (memo ${input.memo.type}: ${input.memo.value})`;
  } else {
    subject = { chain: "stellar", account: input.address };
    display = input.address;
  }

  const hasSub = subject.chain === "stellar" && !!subject.sub;
  const reasons: Reason[] = hasSub
    ? [{ code: "SUBACCOUNT_RESOLVED", points: 0, severity: "info", title: "Sub-account resolved", detail: "Screened the customer under the shared account, not just the shared account." }]
    : [{
        code: "SHARED_ACCOUNT_NO_SUBACCOUNT",
        points: 30,
        severity: "medium",
        title: "Shared account without a memo or muxed ID",
        detail: "Most inbound payments to this account carry a memo or muxed ID. A payment without one may not reach the intended customer.",
      }];
  const score = reasons.reduce((sum, r) => sum + r.points, 4);
  return {
    id: crypto.randomUUID(),
    subject,
    display,
    score,
    band: score >= 25 ? "medium" : "low",
    decision: score >= 25 ? "review" : "allow",
    reasons,
    profile: { exists: true, observedTransfers: 200, fullHistory: false, sharedAccountRatio: 0.94 },
    counterparties: [],
    transfers: [],
    stats: { transfers: 200, inbound: 150, outbound: 50, dustFiltered: 0 },
    screenedAt: new Date().toISOString(),
    engineVersion: "demo",
  };
}
