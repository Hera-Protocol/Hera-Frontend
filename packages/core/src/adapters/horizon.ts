import { isDust } from "../dust";
import { normalizeMemo } from "../stellar/memo";
import { sharedAccountEvidence } from "../stellar/omnibus";
import { ENDPOINT_SEP, parseStellarToml, tomlListsAccount } from "../stellar/toml";
import type { Asset, DataWindow, StellarTomlSummary, SubjectProfile, Transfer } from "../types";
import { type AdapterOptions, ChainDataError, Deadline, getJson, getPaged, getText, settle } from "./http";

export const HORIZON_PUBLIC = "https://horizon.stellar.org";

const PAGE_LIMIT = 200;

export const HORIZON_DEFAULTS = {
  /** 3 × 200 payments: enough history for a muxed or memo customer view on a busy omnibus account. */
  maxPages: 3,
  deadlineMs: 20_000,
  /** Claimable balances resolved per screen (one request each, run in parallel). */
  claimBudget: 10,
} as const;

/* ─── Raw Horizon shapes (only the fields we read) ───── */

interface HorizonAccount {
  account_id: string;
  home_domain?: string;
  flags: { auth_required: boolean; auth_revocable: boolean; auth_clawback_enabled: boolean };
  balances: { asset_type: string; balance: string }[];
}

interface HorizonBalanceChange {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  type: string;
  from?: string;
  to?: string;
  amount: string;
}

interface HorizonTxMemo {
  memo_type?: string;
  memo?: string;
}

export interface HorizonPaymentRecord {
  id: string;
  paging_token?: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  transaction_successful: boolean;
  source_account?: string;
  from?: string;
  from_muxed_id?: string;
  to?: string;
  to_muxed_id?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  // path payments
  source_amount?: string;
  source_asset_type?: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  // create_account
  funder?: string;
  funder_muxed_id?: string;
  account?: string;
  starting_balance?: string;
  // account_merge
  account_muxed_id?: string;
  into?: string;
  into_muxed_id?: string;
  // invoke_host_function (Soroban SAC transfers)
  asset_balance_changes?: HorizonBalanceChange[];
  transaction?: HorizonTxMemo;
}

interface HorizonPage<T> {
  _links?: { next?: { href: string } };
  _embedded: { records: T[] };
}

interface HorizonOperation {
  id: string;
  type: string;
  created_at: string;
  account?: string;
  transaction_hash?: string;
  transaction_successful?: boolean;
  source_account?: string;
  source_account_muxed_id?: string;
  // create_claimable_balance
  asset?: string;
  amount?: string;
  // claim_claimable_balance
  balance_id?: string;
  claimant?: string;
  transaction?: HorizonTxMemo;
}

interface HorizonEffect {
  type: string;
  account: string;
  balance_id?: string;
  asset?: string;
  amount?: string;
  created_at: string;
}

export interface StellarAccountData {
  profile: SubjectProfile;
  /** All non-dust transfers involving the base account, newest first. */
  transfers: Transfer[];
  dustFiltered: number;
}

export interface HorizonOptions extends AdapterOptions {
  horizonUrl?: string;
  /** Max claimable balances resolved into transfers per screen. 0 disables claim lookups. */
  claimBudget?: number;
}

function asset(record: { asset_type?: string; asset_code?: string; asset_issuer?: string }): Asset {
  return record.asset_type === "native" || !record.asset_type
    ? { code: "XLM", decimals: 7 }
    : { code: record.asset_code ?? "?", issuer: record.asset_issuer, decimals: 7 };
}

/** Claimable balances and effects write assets as "native" or "CODE:ISSUER". */
function canonicalAsset(value: string | undefined): Asset {
  if (!value || value === "native") return { code: "XLM", decimals: 7 };
  const [code, issuer] = value.split(":");
  return { code: code ?? "?", issuer, decimals: 7 };
}

function memoOf(tx: HorizonTxMemo | undefined): Transfer["memo"] {
  return normalizeMemo(tx?.memo_type, tx?.memo);
}

/** Map one Horizon payments-endpoint record to zero or more normalized transfers. */
export function normalizeHorizonRecord(record: HorizonPaymentRecord): Transfer[] {
  const base = {
    chain: "stellar" as const,
    txHash: record.transaction_hash,
    timestamp: record.created_at,
    successful: record.transaction_successful,
    memo: memoOf(record.transaction),
  };

  switch (record.type) {
    case "payment":
      if (!record.from || !record.to || !record.amount) return [];
      return [{
        ...base,
        id: record.id,
        kind: "payment",
        from: { address: record.from, muxedId: record.from_muxed_id },
        to: { address: record.to, muxedId: record.to_muxed_id },
        asset: asset(record),
        amount: record.amount,
      }];
    case "path_payment_strict_send":
    case "path_payment_strict_receive":
      if (!record.from || !record.to || !record.amount) return [];
      return [{
        ...base,
        id: record.id,
        kind: "path_payment",
        from: { address: record.from, muxedId: record.from_muxed_id },
        to: { address: record.to, muxedId: record.to_muxed_id },
        asset: asset(record),
        amount: record.amount,
        sourceAsset: asset({
          asset_type: record.source_asset_type,
          asset_code: record.source_asset_code,
          asset_issuer: record.source_asset_issuer,
        }),
        ...(record.source_amount ? { sourceAmount: record.source_amount } : {}),
      }];
    case "create_account":
      if (!record.funder || !record.account) return [];
      return [{
        ...base,
        id: record.id,
        kind: "create_account",
        from: { address: record.funder, muxedId: record.funder_muxed_id },
        to: { address: record.account },
        asset: { code: "XLM", decimals: 7 },
        amount: record.starting_balance ?? "0",
      }];
    case "account_merge":
      if (!record.account || !record.into) return [];
      // Horizon's payments feed does not include the merged amount.
      return [{
        ...base,
        id: record.id,
        kind: "merge",
        from: { address: record.account, muxedId: record.account_muxed_id },
        to: { address: record.into, muxedId: record.into_muxed_id },
        asset: { code: "XLM", decimals: 7 },
        amount: "0",
      }];
    case "invoke_host_function":
      return (record.asset_balance_changes ?? [])
        .filter((change) => change.type === "transfer" && change.from && change.to)
        .map((change, index) => ({
          ...base,
          id: `${record.id}-${index}`,
          kind: "payment" as const,
          from: { address: change.from! },
          to: { address: change.to! },
          asset: asset(change),
          amount: change.amount,
        }));
    default:
      return [];
  }
}

/**
 * Turn a claimable balance's operation history into a transfer. Value moves when
 * the balance is claimed, from the creator to the claimant, so that is the
 * transfer. The memo comes from the creating transaction: that is what the
 * sender attached. Returns null when the balance is unclaimed, was reclaimed by
 * its creator, or its creation is outside Horizon's retained history.
 */
export function normalizeClaim(operations: HorizonOperation[]): Transfer | null {
  const create = operations.find((op) => op.type === "create_claimable_balance");
  const claim = operations.find((op) => op.type === "claim_claimable_balance");
  if (!create?.source_account || !create.amount || !claim) return null;
  const claimant = claim.claimant ?? claim.source_account;
  if (!claimant || claimant === create.source_account) return null;
  return {
    id: `${claim.id}:claim`,
    chain: "stellar",
    txHash: claim.transaction_hash ?? "",
    timestamp: claim.created_at,
    kind: "claim",
    from: { address: create.source_account, muxedId: create.source_account_muxed_id },
    to: { address: claimant, muxedId: claim.source_account === claimant ? claim.source_account_muxed_id : undefined },
    asset: canonicalAsset(create.asset),
    amount: create.amount,
    memo: memoOf(create.transaction),
    successful: claim.transaction_successful ?? true,
  };
}

async function readToml(domain: string, account: string, options: HorizonOptions): Promise<StellarTomlSummary> {
  const text = await getText(`https://${domain}/.well-known/stellar.toml`, options);
  // Some hosts answer with an HTML error page and status 200.
  if (!text || /^\s*</.test(text)) return { domain, status: "unavailable", seps: [] };

  const toml = parseStellarToml(text);
  const seps = Object.keys(toml.endpoints).map((key) => ENDPOINT_SEP[key as keyof typeof ENDPOINT_SEP]);
  return {
    domain,
    orgName: toml.orgName,
    signingKey: toml.signingKey,
    status: tomlListsAccount(toml, account) ? "verified" : "unlisted",
    seps: ["SEP-1", ...seps],
  };
}

/** Follow `_links.next`, keeping our configured base URL (Horizon may sit behind a proxy). */
function nextPageUrl(base: string, page: HorizonPage<unknown>): string | null {
  if (page._embedded.records.length < PAGE_LIMIT) return null;
  const href = page._links?.next?.href;
  if (!href) return null;
  return `${base}${new URL(href).search}`;
}

/** Look up claimable balances the account claimed (or created and someone else claimed). */
async function fetchClaims(
  horizon: string,
  account: string,
  effects: HorizonEffect[],
  budget: number,
  options: HorizonOptions,
  deadline: Deadline,
): Promise<{ transfers: Transfer[]; resolved: number; skipped: number }> {
  const claimed = effects.filter((e) => e.type === "claimable_balance_claimed" && e.account === account && e.balance_id);
  const created = effects.filter((e) => e.type === "claimable_balance_created" && e.account === account && e.balance_id);
  const ids = [...new Set([...claimed, ...created].map((e) => e.balance_id!))];
  const lookups = ids.slice(0, budget);

  const results = await Promise.all(
    lookups.map(async (id) => {
      try {
        const page = await getJson<HorizonPage<HorizonOperation>>(
          `${horizon}/claimable_balances/${id}/operations?limit=10&order=asc&join=transactions&include_failed=false`,
          deadline.bound(options),
        );
        return page ? normalizeClaim(page._embedded.records) : null;
      } catch {
        return null;
      }
    }),
  );
  const transfers = results.filter((t): t is Transfer => t !== null);
  const claimedIds = new Set(claimed.map((e) => e.balance_id));
  // Claims we saw but could not turn into a transfer (budget, retention, errors).
  const unresolvedClaims = ids.filter((id) => claimedIds.has(id)).length - transfers.filter((t) => t.to.address === account).length;
  return { transfers, resolved: transfers.length, skipped: Math.max(0, unresolvedClaims) };
}

export async function fetchStellarAccount(account: string, options: HorizonOptions = {}): Promise<StellarAccountData> {
  const horizon = options.horizonUrl ?? HORIZON_PUBLIC;
  const deadline = new Deadline(options.deadlineMs ?? HORIZON_DEFAULTS.deadlineMs);
  const maxPages = Math.max(1, options.maxPages ?? HORIZON_DEFAULTS.maxPages);
  const claimBudget = Math.max(0, options.claimBudget ?? HORIZON_DEFAULTS.claimBudget);
  const paymentsBase = `${horizon}/accounts/${account}/payments`;

  const infoP = getJson<HorizonAccount>(`${horizon}/accounts/${account}`, deadline.bound(options));
  // The toml only needs the account record, so it runs alongside payment paging.
  const tomlP = infoP.then((info) =>
    info?.home_domain ? readToml(info.home_domain, account, deadline.bound({ ...options, timeoutMs: Math.min(options.timeoutMs ?? 6_000, 6_000) })) : undefined,
  );
  const paymentsP = getPaged<HorizonPage<HorizonPaymentRecord>>(
    `${paymentsBase}?limit=${PAGE_LIMIT}&order=desc&join=transactions&include_failed=false`,
    (page) => nextPageUrl(paymentsBase, page),
    { ...options, maxPages },
    deadline,
  );
  const firstOpsP = getJson<HorizonPage<HorizonOperation>>(
    `${horizon}/accounts/${account}/operations?limit=1&order=asc&include_failed=false`,
    deadline.bound(options),
  );
  // Claims are best-effort: a slow or failed effects read never fails the screen.
  const claimsP = claimBudget
    ? getJson<HorizonPage<HorizonEffect>>(`${horizon}/accounts/${account}/effects?limit=${PAGE_LIMIT}&order=desc`, deadline.bound(options))
        .then(async (page) => {
          const effects = page?._embedded.records ?? [];
          const claims = await fetchClaims(horizon, account, effects, claimBudget, options, deadline);
          return { ...claims, records: effects.length, complete: effects.length < PAGE_LIMIT };
        })
        .catch(() => null)
    : Promise.resolve(null);

  // Each source is settled on its own: a slow source degrades the result, it does not fail it.
  const [infoS, paymentsS, firstOpsS, toml, claims] = await Promise.all([
    settle(infoP),
    settle(paymentsP),
    settle(firstOpsP),
    tomlP.catch(() => undefined),
    claimsP,
  ]);
  const sources = { account: infoS, payments: paymentsS, operations: firstOpsS };
  const failures = Object.entries(sources).filter(([, r]) => !r.ok) as [string, { ok: false; error: ChainDataError }][];
  if (failures.length === Object.keys(sources).length) throw failures[0]![1].error;

  const info = infoS.ok ? infoS.value : undefined;
  const payments = paymentsS.ok ? paymentsS.value : null;
  const firstOps = firstOpsS.ok ? firstOpsS.value : null;

  // A 404 on the account endpoint is a definite "never seen".
  if (infoS.ok && !info) {
    return { profile: { exists: false, observedTransfers: 0, fullHistory: true, dataStatus: "complete" }, transfers: [], dustFiltered: 0 };
  }
  const missing = failures.map(([name]) => name);
  const missedDeadline = failures.some(([, f]) => f.error.kind === "timeout");

  const records = (payments?.pages ?? []).flatMap((page) => page._embedded.records);
  const all = [...records.flatMap(normalizeHorizonRecord), ...(claims?.transfers ?? [])].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || a.id.localeCompare(b.id),
  );
  const transfers = all.filter((t) => !isDust(t));

  // Horizon only retains recent history, so the oldest visible operation is
  // the account's creation only if it actually is a create_account for it.
  const firstOp = firstOps?._embedded.records[0];
  const createdAt = firstOp?.type === "create_account" && firstOp.account === account ? firstOp.created_at : undefined;

  const paymentsComplete = paymentsS.ok && (payments?.complete ?? true);
  const claimsComplete = claimBudget === 0 || (claims !== null && claims.complete && claims.skipped === 0);
  const native = info?.balances.find((b) => b.asset_type === "native");

  const window: DataWindow = {
    pages: { payments: payments?.pages.length ?? 0, effects: claims ? 1 : 0 },
    records: records.length + (claims?.records ?? 0),
    ...(missing.length ? { truncatedBy: missedDeadline ? "deadline" : "error", missing } : payments?.truncatedBy ? { truncatedBy: payments.truncatedBy } : {}),
    ...(claims ? { claimsResolved: claims.resolved, claimsSkipped: claims.skipped } : {}),
    ...(records.length ? { oldest: records.at(-1)!.created_at } : {}),
  };

  return {
    profile: {
      exists: true,
      createdAt,
      firstSeen: transfers.at(-1)?.timestamp,
      observedTransfers: transfers.length,
      fullHistory: missing.length === 0 && paymentsComplete && claimsComplete && createdAt !== undefined,
      nativeBalance: native?.balance,
      homeDomain: info?.home_domain,
      toml,
      ...(info
        ? {
            flags: {
              authRequired: info.flags.auth_required,
              authRevocable: info.flags.auth_revocable,
              clawbackEnabled: info.flags.auth_clawback_enabled,
            },
          }
        : {}),
      sharedAccountRatio: sharedAccountEvidence(account, transfers).ratio,
      window,
      dataStatus: missing.length ? "partial" : "complete",
    },
    transfers,
    dustFiltered: all.length - transfers.length,
  };
}
