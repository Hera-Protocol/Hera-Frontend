/**
 * Stellar Horizon API client — fetches real on-chain data from public accounts.
 * Uses the public Horizon endpoint (https://horizon.stellar.org).
 * All data is publicly available on the Stellar ledger.
 */

const HORIZON_BASE = "https://horizon.stellar.org";

/* ─── Known Public Accounts ─────────────────────────── */

export interface KnownAccount {
  id: string;
  label: string;
  address: string;
  description: string;
  category: "issuer" | "anchor" | "foundation" | "exchange";
}

export const KNOWN_ACCOUNTS: KnownAccount[] = [
  {
    id: "circle-usdc",
    label: "Circle (USDC Issuer)",
    address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    description: "Circle's USDC stablecoin issuing account on Stellar",
    category: "issuer",
  },
  {
    id: "circle-ops",
    label: "Circle Operations",
    address: "GAFK7XFZHMLSNV7OJTBO7BAIZA66X6QIBV5RMZZYXK4Q7ZSO52J5C3WQ",
    description: "Circle's active USDC distribution and operations wallet",
    category: "anchor",
  },
  {
    id: "stablecoin-hub",
    label: "Stablecoin Settlement Hub",
    address: "GDSQAEHJLE2ZZMQZ47YWLP3O2HVPYQ4QCFWTHUKMKF6RIX2ZJJDDMK4N",
    description: "High-volume USDC + EURC settlement and liquidity account",
    category: "exchange",
  },
];

/* ─── Raw Horizon Types ─────────────────────────────── */

export interface HorizonAccountInfo {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  home_domain?: string;
  last_modified_ledger: number;
  balances: HorizonBalance[];
  signers: { key: string; weight: number; type: string }[];
  flags: { auth_required: boolean; auth_revocable: boolean; auth_immutable: boolean; auth_clawback_enabled: boolean };
}

export interface HorizonBalance {
  balance: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  limit?: string;
}

export interface HorizonPayment {
  id: string;
  paging_token: string;
  transaction_successful: boolean;
  source_account: string;
  type: string;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  from: string;
  to: string;
  amount: string;
  // path_payment fields
  source_asset_type?: string;
  source_asset_code?: string;
  source_amount?: string;
  // create_account fields
  account?: string;
  funder?: string;
  starting_balance?: string;
}

export interface HorizonOperation {
  id: string;
  paging_token: string;
  transaction_successful: boolean;
  source_account: string;
  type: string;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  // payment
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  from?: string;
  to?: string;
  amount?: string;
  // path_payment_strict_receive / send
  source_asset_type?: string;
  source_asset_code?: string;
  source_amount?: string;
  // create_account
  account?: string;
  funder?: string;
  starting_balance?: string;
  // clawback
  // generic
}

export interface HorizonTransaction {
  id: string;
  paging_token: string;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  fee_charged: string;
  operation_count: number;
  memo_type: string;
  memo?: string;
  successful: boolean;
}

export interface HorizonResponse<T> {
  _embedded: { records: T[] };
  _links: { next?: { href: string }; prev?: { href: string } };
}

/* ─── Stellar TOML Types ────────────────────────────── */

export interface StellarTomlInfo {
  web_auth_endpoint?: string;
  transfer_server?: string;
  transfer_server_sep0024?: string;
  kyc_server?: string;
  signing_key?: string;
  org_name?: string;
  org_url?: string;
  org_dba?: string;
  org_description?: string;
  currencies?: { code: string; issuer?: string; status?: string; display_decimals?: number }[];
}

/* ─── API Functions ─────────────────────────────────── */

async function horizonFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${HORIZON_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Horizon API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAccountInfo(accountId: string): Promise<HorizonAccountInfo> {
  return horizonFetch<HorizonAccountInfo>(`/accounts/${accountId}`);
}

export async function fetchPayments(
  accountId: string,
  limit = 20,
  order: "asc" | "desc" = "desc",
): Promise<HorizonPayment[]> {
  // Fetch more records than needed to filter out dust/spam transactions
  // (many Stellar accounts receive 0.0000001 XLM spam payments)
  const fetchLimit = Math.min(limit * 10, 200);
  const data = await horizonFetch<HorizonResponse<HorizonPayment>>(
    `/accounts/${accountId}/payments?limit=${fetchLimit}&order=${order}`,
  );
  const records = data._embedded.records;

  // Filter out dust spam (< 0.01 of any asset)
  const meaningful = records.filter((r) => {
    const amt = parseFloat(r.amount || r.starting_balance || "0");
    return amt >= 0.01;
  });

  // If filtering removed too many, fall back to unfiltered
  if (meaningful.length < 3 && records.length > 0) {
    return records.slice(0, limit);
  }

  return meaningful.slice(0, limit);
}

export async function fetchOperations(
  accountId: string,
  limit = 30,
  order: "asc" | "desc" = "desc",
): Promise<HorizonOperation[]> {
  const data = await horizonFetch<HorizonResponse<HorizonOperation>>(
    `/accounts/${accountId}/operations?limit=${limit}&order=${order}`,
  );
  return data._embedded.records;
}

export async function fetchTransactions(
  accountId: string,
  limit = 20,
  order: "asc" | "desc" = "desc",
): Promise<HorizonTransaction[]> {
  // Fetch more transactions to ensure we have tx data for all filtered payments
  const fetchLimit = Math.min(limit * 5, 200);
  const data = await horizonFetch<HorizonResponse<HorizonTransaction>>(
    `/accounts/${accountId}/transactions?limit=${fetchLimit}&order=${order}`,
  );
  return data._embedded.records;
}

/**
 * Fetch and parse a stellar.toml file from a domain.
 * The stellar.toml is a public file hosted at /.well-known/stellar.toml
 * per SEP-1. It contains SEP endpoint URLs, org info, and currency metadata.
 *
 * Many domains block cross-origin requests (CORS), so we try multiple
 * approaches: direct fetch first, then known fallback data for major anchors.
 */
export async function fetchStellarToml(domain: string): Promise<StellarTomlInfo> {
  // Known stellar.toml data for major anchors (avoids CORS issues)
  const knownToml: Record<string, StellarTomlInfo> = {
    "circle.com": {
      org_name: "Circle Internet Financial",
      org_url: "https://circle.com",
      org_description: "Circle is a global financial technology firm",
      web_auth_endpoint: "https://stellar-sep10.circle.com/auth",
      transfer_server: "https://stellar-sep6.circle.com",
      kyc_server: "https://stellar-sep12.circle.com",
      signing_key: "GAYKJM2MJHKKNSXFBXNQGO2OELJ4VU7X4MC5ZHGA45YMGQBZSDNZ3G5L",
      currencies: [
        { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", status: "live" },
        { code: "EURC", issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y36DAVIZA67LPRBBHKOBD4VE", status: "live" },
      ],
    },
    "lobstr.co": {
      org_name: "LOBSTR",
      org_url: "https://lobstr.co",
      org_description: "LOBSTR Stellar Wallet",
      web_auth_endpoint: "https://lobstr.co/sep10/auth",
      currencies: [],
    },
    "stellar.org": {
      org_name: "Stellar Development Foundation",
      org_url: "https://stellar.org",
      org_description: "SDF — the non-profit supporting Stellar network development",
      currencies: [],
    },
  };

  // Check known data first
  if (knownToml[domain]) return knownToml[domain];

  // Try direct fetch (may fail due to CORS)
  try {
    const url = `https://${domain}/.well-known/stellar.toml`;
    const response = await fetch(url);
    if (!response.ok) return {};
    const text = await response.text();
    return parseStellarToml(text);
  } catch {
    // CORS or network error — return empty
    return {};
  }
}

function parseStellarToml(text: string): StellarTomlInfo {
  const result: StellarTomlInfo = {};
  const lines = text.split("\n");

  let inCurrency = false;
  let currentCurrency: Record<string, string> = {};

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#") || line === "") continue;

    if (line === "[[CURRENCIES]]") {
      if (inCurrency && currentCurrency.code) {
        if (!result.currencies) result.currencies = [];
        result.currencies.push({
          code: currentCurrency.code,
          issuer: currentCurrency.issuer,
          status: currentCurrency.status,
        });
      }
      inCurrency = true;
      currentCurrency = {};
      continue;
    }

    if (line.startsWith("[[") && line !== "[[CURRENCIES]]") {
      if (inCurrency && currentCurrency.code) {
        if (!result.currencies) result.currencies = [];
        result.currencies.push({
          code: currentCurrency.code,
          issuer: currentCurrency.issuer,
          status: currentCurrency.status,
        });
      }
      inCurrency = false;
      continue;
    }

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim().toLowerCase();
    let val = line.slice(eqIdx + 1).trim();
    // strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    if (inCurrency) {
      currentCurrency[key] = val;
    } else {
      switch (key) {
        case "web_auth_endpoint": result.web_auth_endpoint = val; break;
        case "transfer_server": result.transfer_server = val; break;
        case "transfer_server_sep0024": result.transfer_server_sep0024 = val; break;
        case "kyc_server": result.kyc_server = val; break;
        case "signing_key": result.signing_key = val; break;
        case "org_name": result.org_name = val; break;
        case "org_url": result.org_url = val; break;
        case "org_dba": result.org_dba = val; break;
        case "org_description": result.org_description = val; break;
      }
    }
  }

  // flush last currency
  if (inCurrency && currentCurrency.code) {
    if (!result.currencies) result.currencies = [];
    result.currencies.push({
      code: currentCurrency.code,
      issuer: currentCurrency.issuer,
      status: currentCurrency.status,
    });
  }

  return result;
}
