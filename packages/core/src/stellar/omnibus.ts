import type { Transfer } from "../types";

/**
 * Shared-account (omnibus) inference for Stellar base accounts.
 *
 * An exchange or anchor receives deposits for many customers on one `G…`
 * account and tells them apart by muxed id or memo. Screening that base account
 * without the sub-account says little about the actual customer, so Hera warns.
 *
 * The rule, and why each part exists:
 *  - Only successful, non-dust inbound payments from another account count.
 *    Dust is where Stellar spam lives, and spam always carries a text memo.
 *  - Payments of an account's own asset back to it are burns (redemptions to the
 *    issuer), not deposits. Circle's USDC issuer receives thousands of these
 *    with the text memo "internal"; they must not make it look like an omnibus.
 *  - A routing identifier is a muxed id, an id memo, or a text memo that looks
 *    like an identifier (contains a digit, no spaces, at most 28 bytes). Many
 *    users type their exchange deposit id into a text memo, so numeric text
 *    memos count; sentences ("Buy NXR & earn XLM!") never do. Hash and return
 *    memos identify payments, not customers, so they do not count.
 *  - The account needs at least 10 eligible inbound payments, at least half of
 *    them routed, and at least 5 distinct routing identifiers. One repeated
 *    memo is a habit of one sender, not a customer base.
 *  - Accounts labeled `issuer` are never inferred to be omnibus (risk.ts).
 *    Accounts labeled `exchange` or `anchor` always are.
 */
export const OMNIBUS_RULE = { minEligible: 10, minRatio: 0.5, minDistinct: 5 } as const;

const TEXT_ROUTING_ID = /^(?=.*\d)[A-Za-z0-9_-]{1,28}$/;
const ROUTABLE_KINDS = new Set<Transfer["kind"]>(["payment", "path_payment", "claim"]);

export interface SharedAccountEvidence {
  /** Inbound payments that could carry a routing identifier. */
  eligibleInbound: number;
  /** Of those, how many did. */
  routedInbound: number;
  /** Distinct routing identifiers seen. */
  distinctRoutes: number;
  ratio: number;
}

/** The routing identifier a transfer carries to `account`, or undefined. */
export function routingKey(account: string, transfer: Transfer): string | undefined {
  if (transfer.to.address !== account) return undefined;
  if (transfer.to.muxedId) return `muxed:${transfer.to.muxedId}`;
  const memo = transfer.memo;
  if (!memo) return undefined;
  if (memo.type === "id") return `id:${memo.value}`;
  if (memo.type === "text" && TEXT_ROUTING_ID.test(memo.value)) return `text:${memo.value}`;
  return undefined;
}

/** `transfers` must already exclude dust (the adapters drop it). */
export function sharedAccountEvidence(account: string, transfers: Transfer[]): SharedAccountEvidence {
  let eligibleInbound = 0;
  let routedInbound = 0;
  const routes = new Set<string>();
  for (const t of transfers) {
    if (!t.successful || !ROUTABLE_KINDS.has(t.kind)) continue;
    if (t.to.address !== account || t.from.address === account) continue;
    if (t.asset.issuer === account) continue; // burn: the issuer's own asset coming home
    eligibleInbound++;
    const key = routingKey(account, t);
    if (key) {
      routedInbound++;
      routes.add(key);
    }
  }
  return {
    eligibleInbound,
    routedInbound,
    distinctRoutes: routes.size,
    ratio: eligibleInbound ? routedInbound / eligibleInbound : 0,
  };
}

export function looksLikeOmnibus(evidence: SharedAccountEvidence): boolean {
  return (
    evidence.eligibleInbound >= OMNIBUS_RULE.minEligible &&
    evidence.ratio >= OMNIBUS_RULE.minRatio &&
    evidence.distinctRoutes >= OMNIBUS_RULE.minDistinct
  );
}
