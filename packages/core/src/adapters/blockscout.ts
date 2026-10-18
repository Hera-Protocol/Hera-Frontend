import { formatUnits } from "../amount";
import { BLOCKSCOUT_API, getChain } from "../chains";
import { isDust } from "../dust";
import { checkEvmAddress } from "../evm/address";
import type { DataWindow, SubjectProfile, Transfer } from "../types";
import { type AdapterOptions, ChainDataError, Deadline, getJson, getPaged, type PagedResult, settle } from "./http";

/**
 * Blockscout v2 adapter. Blockscout is open source, so this data source can be
 * self-hosted. We deliberately ignore its third-party tags and reputation
 * fields: Hera's risk opinions come from Hera's own labels and heuristics.
 */

export const BLOCKSCOUT_DEFAULTS = {
  /** Pages per endpoint (Blockscout serves 50 items per page). */
  maxPages: 2,
  deadlineMs: 15_000,
} as const;

/** EIP-7702 delegation designator: 0xef0100 ‖ 20-byte delegate address. */
const DELEGATION_PREFIX = "0xef0100";

interface BsAddressRef {
  hash: string;
}

export interface BsAddress {
  hash: string;
  coin_balance: string | null;
  is_contract: boolean;
  ens_domain_name: string | null;
  /** "eip7702" for delegated EOAs; proxy standards (e.g. "eip1967") for real proxies. */
  proxy_type?: string | null;
  implementations?: { address_hash: string; name?: string | null }[] | null;
  creation_transaction_hash?: string | null;
  creator_address_hash?: string | null;
}

interface BsSmartContract {
  deployed_bytecode?: string | null;
  proxy_type?: string | null;
}

interface BsTransaction {
  hash: string;
  timestamp: string;
  from: BsAddressRef;
  to: BsAddressRef | null;
  value: string;
  /** "ok", "error", or null while pending. */
  status: string | null;
}

interface BsInternalTransaction {
  transaction_hash: string;
  index: number;
  timestamp: string;
  type?: string;
  from: BsAddressRef;
  to: BsAddressRef | null;
  value: string;
  success: boolean;
}

interface BsTokenTransfer {
  transaction_hash: string;
  log_index: number;
  timestamp: string;
  from: BsAddressRef;
  to: BsAddressRef;
  total: { value?: string; decimals?: string | null; token_id?: string } | null;
  token: { symbol: string | null; address_hash?: string; address?: string; type: string; decimals: string | null };
}

interface BsPage<T> {
  items: T[];
  next_page_params: Record<string, unknown> | null;
}

export interface EvmAccountData {
  profile: SubjectProfile;
  transfers: Transfer[];
  dustFiltered: number;
}

export interface BlockscoutOptions extends AdapterOptions {
  apiUrl?: string;
}

const checksum = (address: string) => {
  const result = checkEvmAddress(address.toLowerCase());
  return result.ok ? result.address : address;
};

function nextPageUrl(base: string, page: BsPage<unknown>): string | null {
  const params = page.next_page_params;
  if (!params) return null;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) query.set(key, String(value));
  }
  return `${base}?${query.toString()}`;
}

/** Internal calls that cannot move value: their `value` echoes the caller's context. */
const NON_VALUE_CALLS = new Set(["delegatecall", "staticcall"]);

/**
 * The EIP-7702 delegate for an address, if it is a delegated EOA. Blockscout
 * reports these with `is_contract: true`, because the account has code, but
 * the code is only a 23-byte delegation pointer and the account is still a
 * key-controlled wallet. `proxy_type: "eip7702"` is the reliable signal; the
 * bytecode prefix is the fallback when an older instance omits proxy_type.
 */
export function eip7702Delegate(account: BsAddress, contract?: BsSmartContract | null): { delegatedTo?: string } | null {
  const proxyType = account.proxy_type ?? contract?.proxy_type;
  const code = contract?.deployed_bytecode?.toLowerCase();
  const fromCode = code?.startsWith(DELEGATION_PREFIX) && code.length === DELEGATION_PREFIX.length + 40 ? `0x${code.slice(DELEGATION_PREFIX.length)}` : undefined;
  if (proxyType !== "eip7702" && !fromCode) return null;
  const delegate = account.implementations?.[0]?.address_hash ?? fromCode;
  return delegate ? { delegatedTo: checksum(delegate) } : {};
}

/** Map raw Blockscout pages to transfers. Exported for fixture tests. */
export function normalizeBlockscout(
  chain: `evm:${number}`,
  txs: BsTransaction[],
  internals: BsInternalTransaction[],
  tokens: BsTokenTransfer[],
): Transfer[] {
  const info = getChain(chain);
  const native = { code: info.nativeSymbol, decimals: info.nativeDecimals };
  const transfers: Transfer[] = [];
  const failedTx = new Set(txs.filter((tx) => tx.status !== "ok").map((tx) => tx.hash));

  for (const tx of txs) {
    if (!tx.to || tx.value === "0") continue; // contract calls without value are not transfers
    transfers.push({
      id: `${tx.hash}:tx`,
      chain,
      txHash: tx.hash,
      timestamp: tx.timestamp,
      kind: "native",
      from: { address: checksum(tx.from.hash) },
      to: { address: checksum(tx.to.hash) },
      asset: native,
      amount: formatUnits(tx.value, native.decimals),
      // "error" is a reverted transaction; null is pending. Neither moved value.
      successful: tx.status === "ok",
    });
  }

  for (const itx of internals) {
    if (!itx.to || itx.value === "0") continue;
    if (itx.type && NON_VALUE_CALLS.has(itx.type)) continue;
    transfers.push({
      id: `${itx.transaction_hash}:itx:${itx.index}`,
      chain,
      txHash: itx.transaction_hash,
      timestamp: itx.timestamp,
      kind: "native",
      from: { address: checksum(itx.from.hash) },
      to: { address: checksum(itx.to.hash) },
      asset: native,
      amount: formatUnits(itx.value, native.decimals),
      successful: itx.success && !failedTx.has(itx.transaction_hash),
    });
  }

  for (const tt of tokens) {
    const type = tt.token.type;
    const decimals = Number(tt.total?.decimals ?? tt.token.decimals ?? 0);
    const isNft = type === "ERC-721" || (type === "ERC-1155" && !tt.total?.value);
    transfers.push({
      id: `${tt.transaction_hash}:log:${tt.log_index}`,
      chain,
      txHash: tt.transaction_hash,
      timestamp: tt.timestamp,
      kind: type === "ERC-721" ? "erc721" : type === "ERC-1155" ? "erc1155" : "erc20",
      from: { address: checksum(tt.from.hash) },
      to: { address: checksum(tt.to.hash) },
      asset: {
        code: tt.token.symbol ?? "TOKEN",
        issuer: checksum(tt.token.address_hash ?? tt.token.address ?? ""),
        decimals: isNft ? 0 : decimals,
      },
      amount: isNft ? "1" : formatUnits(tt.total?.value ?? "0", decimals),
      // Logs only exist for transactions that succeeded.
      successful: !failedTx.has(tt.transaction_hash),
    });
  }

  return transfers.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || a.id.localeCompare(b.id));
}

export async function fetchEvmAccount(
  chain: `evm:${number}`,
  address: string,
  options: BlockscoutOptions = {},
): Promise<EvmAccountData> {
  const api = options.apiUrl ?? BLOCKSCOUT_API[chain];
  if (!api) throw new ChainDataError(`No data source configured for ${chain}`);
  const deadline = new Deadline(options.deadlineMs ?? BLOCKSCOUT_DEFAULTS.deadlineMs);
  const pageOptions = { ...options, maxPages: Math.max(1, options.maxPages ?? BLOCKSCOUT_DEFAULTS.maxPages) };

  const paged = <T>(endpoint: string) => {
    const base = `${api}/addresses/${address}/${endpoint}`;
    return getPaged<BsPage<T>>(base, (page) => nextPageUrl(base, page), pageOptions, deadline);
  };

  // Each source is settled on its own: a slow source degrades the result, it does not fail it.
  const [accountS, txsS, internalsS, tokensS] = await Promise.all([
    settle(getJson<BsAddress>(`${api}/addresses/${address}`, deadline.bound(options))),
    settle(paged<BsTransaction>("transactions")),
    settle(paged<BsInternalTransaction>("internal-transactions")),
    settle(paged<BsTokenTransfer>("token-transfers")),
  ]);
  const sources = { account: accountS, transactions: txsS, internal: internalsS, tokens: tokensS };
  const failures = Object.entries(sources).filter(([, r]) => !r.ok) as [string, { ok: false; error: ChainDataError }][];
  if (failures.length === Object.keys(sources).length) throw failures[0]![1].error;
  const missing = failures.map(([name]) => name);
  const missedDeadline = failures.some(([, f]) => f.error.kind === "timeout");

  const account = accountS.ok ? accountS.value : undefined;
  const txs = txsS.ok ? txsS.value : null;
  const internals = internalsS.ok ? internalsS.value : null;
  const tokens = tokensS.ok ? tokensS.value : null;

  // A 404 on the address endpoint is a definite "never seen".
  if (accountS.ok && !account) {
    return { profile: { exists: false, observedTransfers: 0, fullHistory: true, dataStatus: "complete" }, transfers: [], dustFiltered: 0 };
  }

  // Ambiguous case: code but no proxy_type and no creation transaction. Real
  // contracts are created by a transaction; a delegated EOA never is. Read the
  // code to tell them apart (best-effort).
  let contract: BsSmartContract | null = null;
  if (account?.is_contract && !account.proxy_type && !account.creation_transaction_hash) {
    contract = await getJson<BsSmartContract>(`${api}/smart-contracts/${address}`, deadline.bound(options)).catch(() => null);
  }
  const delegation = account ? eip7702Delegate(account, contract) : null;

  const items = <T>(result: PagedResult<BsPage<T>> | null) => (result?.pages ?? []).flatMap((page) => page.items);
  const rawTxs = items(txs);
  const rawInternals = items(internals);
  const rawTokens = items(tokens);
  const all = normalizeBlockscout(chain, rawTxs, rawInternals, rawTokens);
  const transfers = all.filter((t) => !isDust(t));

  const results = { transactions: txs, internal: internals, tokens };
  const fullHistory = missing.length === 0 && Object.values(results).every((r) => r === null || r.complete);
  const truncated = Object.values(results).map((r) => r?.truncatedBy).filter((x) => x !== undefined);
  const timestamps = [...rawTxs, ...rawInternals, ...rawTokens].map((x) => x.timestamp).filter(Boolean).sort();
  const oldest = timestamps[0];
  const info = getChain(chain);

  const window: DataWindow = {
    pages: Object.fromEntries(Object.entries(results).map(([key, r]) => [key, r?.pages.length ?? 0])),
    records: rawTxs.length + rawInternals.length + rawTokens.length,
    // Report the most severe reason any endpoint stopped early.
    ...(missing.length
      ? { truncatedBy: missedDeadline ? "deadline" : "error", missing }
      : truncated.length
        ? { truncatedBy: truncated.includes("error") ? "error" : truncated.includes("deadline") ? "deadline" : "page_budget" }
        : {}),
    ...(oldest ? { oldest } : {}),
  };

  return {
    profile: {
      exists: true,
      // With the complete history in hand, the oldest record (any kind, failed
      // included: a failed transaction still proves the address existed) is
      // when the address appeared.
      createdAt: fullHistory ? oldest : undefined,
      firstSeen: transfers.at(-1)?.timestamp,
      observedTransfers: transfers.length,
      fullHistory,
      nativeBalance: account?.coin_balance ? formatUnits(account.coin_balance, info.nativeDecimals) : undefined,
      // Unknown (undefined) when the address endpoint did not answer.
      isContract: account ? account.is_contract && !delegation : undefined,
      ...(delegation?.delegatedTo ? { delegatedTo: delegation.delegatedTo } : {}),
      ensName: account?.ens_domain_name ?? undefined,
      window,
      dataStatus: missing.length ? "partial" : "complete",
    },
    transfers,
    dustFiltered: all.length - transfers.length,
  };
}
