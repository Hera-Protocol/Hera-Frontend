import type { ChainId, ChainInfo } from "./types";

function evm(
  chainId: number,
  name: string,
  explorer: string,
  live: boolean,
  nativeSymbol = "ETH",
): ChainInfo {
  return {
    id: `evm:${chainId}`,
    family: "evm",
    name,
    nativeSymbol,
    nativeDecimals: 18,
    explorerTxUrl: (hash) => `${explorer}/tx/${hash}`,
    explorerAddressUrl: (address) => `${explorer}/address/${address}`,
    live,
  };
}

/**
 * Chains Hera knows about. `live` gates screening: only chains whose
 * data source has been verified end to end are enabled. Adding an EVM
 * chain is a one-line change once its Blockscout instance is reachable.
 */
export const CHAINS: Record<string, ChainInfo> = {
  stellar: {
    id: "stellar",
    family: "stellar",
    name: "Stellar",
    nativeSymbol: "XLM",
    nativeDecimals: 7,
    explorerTxUrl: (hash) => `https://stellar.expert/explorer/public/tx/${hash}`,
    explorerAddressUrl: (address) => `https://stellar.expert/explorer/public/account/${address}`,
    live: true,
  },
  "evm:1": evm(1, "Ethereum", "https://eth.blockscout.com", true),
  "evm:8453": evm(8453, "Base", "https://base.blockscout.com", false),
  "evm:42161": evm(42161, "Arbitrum", "https://arbitrum.blockscout.com", false),
  "evm:10": evm(10, "Optimism", "https://optimism.blockscout.com", false),
  "evm:137": evm(137, "Polygon", "https://polygon.blockscout.com", false, "POL"),
};

export const BLOCKSCOUT_API: Partial<Record<ChainId, string>> = {
  "evm:1": "https://eth.blockscout.com/api/v2",
  "evm:8453": "https://base.blockscout.com/api/v2",
  "evm:42161": "https://arbitrum.blockscout.com/api/v2",
  "evm:10": "https://optimism.blockscout.com/api/v2",
  "evm:137": "https://polygon.blockscout.com/api/v2",
};

export function getChain(id: ChainId): ChainInfo {
  const chain = CHAINS[id];
  if (!chain) throw new Error(`Unknown chain: ${id}`);
  return chain;
}

export function listChains(): ChainInfo[] {
  return Object.values(CHAINS);
}
