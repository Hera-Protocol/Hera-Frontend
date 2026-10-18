import { approxNumber, isUsdStablecoin } from "./amount";
import type { Transfer } from "./types";

/**
 * Dust policy. Dust is kept out of every score because it costs nothing to
 * send and anyone can send it to anyone: Stellar spam payments of 0.0000001 XLM
 * with "claim your airdrop" memos, and EVM address-poisoning transfers of zero
 * (or near-zero) tokens. A threshold only makes sense where we know what the
 * asset is worth, so unknown assets use a tiny threshold rather than guessing.
 */
export const DUST_THRESHOLDS = {
  /** XLM. 0.001 XLM is a fraction of a cent; real payments are larger. */
  stellarNative: 0.001,
  /** Known USD stablecoins on any chain: below one cent. */
  usdStablecoin: 0.01,
  /** Other Stellar assets: 100 stroops. Value unknown, so only obvious dust. */
  stellarOther: 0.00001,
} as const;

/** Whether a normalized transfer is dust. Merges (no amount in the feed), account creations and NFTs are never dust. */
export function isDust(transfer: Transfer): boolean {
  if (transfer.kind === "merge" || transfer.kind === "create_account" || transfer.kind === "erc721" || transfer.kind === "erc1155") return false;
  const amount = approxNumber(transfer.amount);
  if (amount <= 0) return true;
  if (isUsdStablecoin(transfer.chain, transfer.asset)) return amount < DUST_THRESHOLDS.usdStablecoin;
  if (transfer.chain === "stellar") {
    return amount < (transfer.asset.issuer ? DUST_THRESHOLDS.stellarOther : DUST_THRESHOLDS.stellarNative);
  }
  // EVM native and other tokens: only exact zero (handled above). Their value is unknown here.
  return false;
}
