/**
 * Minimal SEP-1 stellar.toml reader. We only need a handful of keys, so this
 * is a tolerant subset parser rather than a full TOML implementation:
 * top-level `KEY = "value"` / `KEY = ["a", "b"]` (arrays may span lines),
 * `[DOCUMENTATION]` and `[[CURRENCIES]]` tables.
 */

export interface ParsedStellarToml {
  orgName?: string;
  signingKey?: string;
  accounts: string[];
  currencyIssuers: string[];
  endpoints: Partial<Record<
    "WEB_AUTH_ENDPOINT" | "KYC_SERVER" | "TRANSFER_SERVER" | "TRANSFER_SERVER_SEP0024" | "DIRECT_PAYMENT_SERVER",
    string
  >>;
}

const ENDPOINT_KEYS = [
  "WEB_AUTH_ENDPOINT",
  "KYC_SERVER",
  "TRANSFER_SERVER",
  "TRANSFER_SERVER_SEP0024",
  "DIRECT_PAYMENT_SERVER",
] as const;

/** Which SEP each endpoint advertises. */
export const ENDPOINT_SEP: Record<(typeof ENDPOINT_KEYS)[number], string> = {
  WEB_AUTH_ENDPOINT: "SEP-10",
  KYC_SERVER: "SEP-12",
  TRANSFER_SERVER: "SEP-6",
  TRANSFER_SERVER_SEP0024: "SEP-24",
  DIRECT_PAYMENT_SERVER: "SEP-31",
};

function stripComment(line: string): string {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i - 1] !== "\\") inString = !inString;
    if (char === "#" && !inString) return line.slice(0, i);
  }
  return line;
}

function stringsIn(raw: string): string[] {
  return [...raw.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? "");
}

export function parseStellarToml(text: string): ParsedStellarToml {
  const result: ParsedStellarToml = { accounts: [], currencyIssuers: [], endpoints: {} };
  let table = "";
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = stripComment(lines[i] ?? "").trim();
    if (!line) continue;

    const header = line.match(/^\[\[?\s*([A-Za-z0-9_.]+)\s*\]\]?$/);
    if (header) {
      table = header[1]!.toUpperCase();
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1]!.toUpperCase();
    let raw = kv[2]!;

    // Multi-line arrays: keep reading until brackets balance.
    if (raw.startsWith("[")) {
      while (!raw.includes("]") && i + 1 < lines.length) {
        raw += " " + stripComment(lines[++i] ?? "");
      }
    }
    const values = stringsIn(raw);
    const first = values[0];

    if (table === "") {
      if (key === "ACCOUNTS") result.accounts.push(...values);
      else if (key === "SIGNING_KEY" && first) result.signingKey = first;
      else if ((ENDPOINT_KEYS as readonly string[]).includes(key) && first) {
        result.endpoints[key as (typeof ENDPOINT_KEYS)[number]] = first;
      }
    } else if (table === "DOCUMENTATION" && key === "ORG_NAME" && first) {
      result.orgName = first;
    } else if (table === "CURRENCIES" && key === "ISSUER" && first) {
      result.currencyIssuers.push(first);
    }
  }
  return result;
}

/** An account is attributed to a domain only if the domain's toml lists it back. */
export function tomlListsAccount(toml: ParsedStellarToml, account: string): boolean {
  return (
    toml.accounts.includes(account) ||
    toml.currencyIssuers.includes(account) ||
    toml.signingKey === account
  );
}
