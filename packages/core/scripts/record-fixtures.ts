/**
 * Record live Horizon / Blockscout responses for the golden tests.
 *
 *   pnpm --filter @hera/core build && node packages/core/scripts/record-fixtures.ts [name…]
 *
 * Every request the real adapters make is captured through an injected fetch,
 * trimmed to the fields the adapters read, and written to
 * src/__fixtures__/<name>.json. Recording uses a generous deadline so no page
 * is cut short; replay then serves exactly the recorded URLs.
 * Re-recording changes the golden snapshots: review the diff, then run
 * `vitest -u` deliberately.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchEvmAccount, fetchStellarAccount, parseSubject } from "../dist/index.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/__fixtures__");

export const FIXTURE_SUBJECTS = [
  { name: "circle-usdc-issuer", address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
  { name: "kraken", address: "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM" },
  { name: "cb-claimant", address: "GD25PEWTU6VDOBS2ZPGJVRYGREPLAVBVZ5WQB6WCJRJOZYNJU6QQFSWC" },
  { name: "vitalik", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { name: "ofac-lazarus", address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96" },
  { name: "failed-txs", address: "0xcB4Ef0019663481E3Ab30EEf67e4dFfA9700896c" },
];

type Json = Record<string, unknown>;
const pick = (obj: unknown, keys: string[]): Json => {
  const out: Json = {};
  if (!obj || typeof obj !== "object") return out;
  for (const key of keys) if (key in obj) out[key] = (obj as Json)[key];
  return out;
};
const ref = (r: unknown) => (r ? pick(r, ["hash"]) : r);

const HORIZON_PAYMENT_KEYS = [
  "id", "type", "created_at", "transaction_hash", "transaction_successful",
  "from", "from_muxed_id", "to", "to_muxed_id", "amount", "asset_type", "asset_code", "asset_issuer",
  "source_amount", "source_asset_type", "source_asset_code", "source_asset_issuer",
  "funder", "funder_muxed_id", "account", "starting_balance", "account_muxed_id", "into", "into_muxed_id", "asset_balance_changes",
];
const HORIZON_OP_KEYS = ["id", "type", "created_at", "account", "transaction_hash", "transaction_successful", "source_account", "source_account_muxed_id", "asset", "amount", "balance_id", "claimant"];
const EFFECT_KEYS = ["type", "account", "balance_id", "asset", "amount", "created_at"];

function trim(url: string, body: unknown): unknown {
  const u = new URL(url);
  const path = u.pathname;
  const b = body as Json;
  if (u.host.includes("horizon")) {
    const records = (b._embedded as Json | undefined)?.records as Json[] | undefined;
    const page = (keys: string[], withTx: boolean) => ({
      _links: { next: pick((b._links as Json | undefined)?.next, ["href"]) },
      _embedded: {
        records: records!.map((r) => ({ ...pick(r, keys), ...(withTx && r.transaction ? { transaction: pick(r.transaction, ["memo_type", "memo"]) } : {}) })),
      },
    });
    if (path.endsWith("/payments")) return page(HORIZON_PAYMENT_KEYS, true);
    if (path.endsWith("/effects")) return page(EFFECT_KEYS, false);
    if (path.endsWith("/operations")) return page(HORIZON_OP_KEYS, true);
    if (/^\/accounts\/[^/]+$/.test(path)) {
      return { ...pick(b, ["account_id", "home_domain", "flags"]), balances: (b.balances as Json[]).filter((x) => x.asset_type === "native").map((x) => pick(x, ["asset_type", "balance"])) };
    }
    return body;
  }
  // Blockscout v2
  if (/\/addresses\/[^/]+$/.test(path)) {
    return pick(b, ["hash", "coin_balance", "is_contract", "ens_domain_name", "proxy_type", "implementations", "creation_transaction_hash", "creator_address_hash"]);
  }
  if (path.includes("/smart-contracts/")) return pick(b, ["deployed_bytecode", "proxy_type"]);
  const items = (b.items as Json[]) ?? [];
  const map = (fn: (x: Json) => Json) => ({ items: items.map(fn), next_page_params: b.next_page_params ?? null });
  if (path.endsWith("/transactions")) return map((x) => ({ ...pick(x, ["hash", "timestamp", "value", "status"]), from: ref(x.from), to: ref(x.to) }));
  if (path.endsWith("/internal-transactions")) return map((x) => ({ ...pick(x, ["transaction_hash", "index", "timestamp", "type", "value", "success"]), from: ref(x.from), to: ref(x.to) }));
  if (path.endsWith("/token-transfers")) {
    return map((x) => ({ ...pick(x, ["transaction_hash", "log_index", "timestamp"]), total: x.total ? pick(x.total, ["value", "decimals", "token_id"]) : null, from: ref(x.from), to: ref(x.to), token: pick(x.token, ["symbol", "address_hash", "type", "decimals"]) }));
  }
  return body;
}

interface Recorded {
  status: number;
  json?: unknown;
  text?: string;
}

async function record(name: string, address: string) {
  const responses: Record<string, Recorded> = {};
  const recordingFetch = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), "User-Agent": "hera-fixture-recorder" } });
    const text = await response.text();
    const isJson = (response.headers.get("content-type") ?? "").includes("json");
    responses[url] = isJson && response.ok ? { status: response.status, json: trim(url, JSON.parse(text)) } : { status: response.status, text: response.ok ? text : "" };
    return new Response(text, { status: response.status, headers: response.headers });
  };
  const parsed = parseSubject({ address });
  if (!parsed.ok) throw new Error(parsed.error);
  const recordedAt = new Date().toISOString();
  const options = { fetch: recordingFetch, deadlineMs: 120_000, timeoutMs: 60_000 };
  const s = parsed.subject;
  if (s.chain === "stellar") await fetchStellarAccount(s.account, options);
  else await fetchEvmAccount(s.chain, s.address, options);
  const file = join(OUT, `${name}.json`);
  writeFileSync(file, `${JSON.stringify({ name, address, recordedAt, responses })}\n`);
  console.log(`${name}: ${Object.keys(responses).length} responses → ${file}`);
}

const only = process.argv.slice(2);
for (const s of FIXTURE_SUBJECTS.filter((x) => only.length === 0 || only.includes(x.name))) await record(s.name, s.address);
