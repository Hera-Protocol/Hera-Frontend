/** Convert an integer string in base units (wei, stroops) to a decimal string. */
export function formatUnits(value: string, decimals: number): string {
  const negative = value.startsWith("-");
  const digits = (negative ? value.slice(1) : value).replace(/^0+/, "") || "0";
  if (decimals === 0) return `${negative ? "-" : ""}${digits}`;

  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/**
 * Lossy conversion for heuristics only (thresholds, ratios). Amounts that are
 * stored, displayed or summed for reporting stay decimal strings.
 */
export function approxNumber(amount: string): number {
  const n = Number.parseFloat(amount);
  return Number.isFinite(n) ? n : 0;
}

const USD_STABLES = new Set(["USDC", "USDT", "DAI", "PYUSD", "USDP", "TUSD", "FDUSD", "USDE"]);

/** USD value for stablecoins only; undefined when we would need a price feed. */
export function approxUsd(assetCode: string, amount: string): number | undefined {
  return USD_STABLES.has(assetCode.toUpperCase()) ? approxNumber(amount) : undefined;
}

/**
 * USD stablecoins by issuer, per chain. Symbols are free to choose, so a spam
 * token called "USDC" must not count as dollars: only these issuers do.
 * EVM keys are lowercase contract addresses; Stellar keys are `CODE:ISSUER`.
 * Each address was checked against the chain explorer before being added.
 */
export const USD_STABLECOINS: Record<string, ReadonlySet<string>> = {
  stellar: new Set([
    // Circle, https://developers.circle.com/stablecoins/usdc-contract-addresses
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  ]),
  "evm:1": new Set([
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
    "0x6c3ea9036406852006290770bedfcaba0e23a0e8", // PYUSD
    "0x8e870d67f660d95d5be530380d0ec0bd388289e1", // USDP
    "0x0000000000085d4780b73119b644ae5ecd22b376", // TUSD
    "0xc5f0f7b66764f6ec8c8dff7ba683102295e16409", // FDUSD
    "0x4c9edd5852cd905f086c759e8383e09bff1e68b3", // USDe
  ]),
};

export function isUsdStablecoin(chain: string, asset: { code: string; issuer?: string }): boolean {
  if (!asset.issuer) return false;
  const known = USD_STABLECOINS[chain];
  if (!known) return false;
  return chain === "stellar" ? known.has(`${asset.code}:${asset.issuer}`) : known.has(asset.issuer.toLowerCase());
}

/**
 * Issuer-aware USD value: stablecoins from known issuers only, undefined otherwise.
 * Prefer this over `approxUsd`, which trusts the symbol.
 */
export function approxUsdValue(chain: string, asset: { code: string; issuer?: string }, amount: string): number | undefined {
  return isUsdStablecoin(chain, asset) ? approxNumber(amount) : undefined;
}
