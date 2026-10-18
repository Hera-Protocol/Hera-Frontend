import type { ChainId, Label, LabelCategory } from "./types";

/**
 * Hera's seed label set. Every entry carries its provenance.
 *
 * This is a small, hand-verified starting set so screening is meaningful on
 * day one. In production the API replaces it with labels ingested from the
 * official sources (OFAC SDN XML, UN/EU/UK lists, SEP-1 toml crawls,
 * on-chain issuer freezes); see docs/PLAN.md §5.1.
 */
export const SEED_LABELS: Label[] = [
  {
    chain: "evm:1",
    address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
    category: "sanctions",
    entity: "Lazarus Group (Ronin Bridge exploiter)",
    source: "OFAC SDN list",
    sourceUrl: "https://home.treasury.gov/news/press-releases/jy0731",
    confidence: 1,
    addedAt: "2022-04-14",
  },
  {
    chain: "evm:1",
    address: "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b",
    category: "mixer",
    entity: "Tornado Cash: Router",
    source: "Contract metadata (Hera analyst)",
    confidence: 0.95,
    addedAt: "2025-03-21",
    note: "Removed from the OFAC SDN list on 2025-03-21. Still treated as a mixer for exposure purposes.",
  },
  {
    chain: "evm:1",
    address: "0x28C6c06298d514Db089934071355E5743bf21d60",
    category: "exchange",
    entity: "Binance: Hot Wallet 14",
    source: "Exchange proof-of-reserves disclosure",
    confidence: 0.9,
    addedAt: "2024-01-01",
  },
  {
    chain: "evm:1",
    address: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3",
    category: "exchange",
    entity: "Coinbase: Hot Wallet 1",
    source: "Hera analyst (deposit sweep pattern)",
    confidence: 0.85,
    addedAt: "2024-01-01",
  },
  {
    chain: "stellar",
    address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    category: "issuer",
    entity: "Circle: USDC issuer",
    source: "Circle developer docs: USDC issuer addresses",
    sourceUrl: "https://developers.circle.com/stablecoins/usdc-contract-addresses",
    confidence: 1,
    addedAt: "2021-02-01",
  },
];

/** Severity used by the risk engine (docs/PLAN.md §5.3). */
export const CATEGORY_SEVERITY: Record<LabelCategory, number> = {
  sanctions: 100,
  terrorist_financing: 100,
  stolen_funds: 90,
  ransomware: 90,
  darknet: 85,
  mixer: 75,
  scam: 70,
  high_risk_exchange: 50,
  gambling: 40,
  defi: 10,
  bridge: 10,
  exchange: 5,
  anchor: 5,
  issuer: 5,
};

export const CATEGORY_LABEL: Record<LabelCategory, string> = {
  sanctions: "Sanctioned",
  terrorist_financing: "Terrorist financing",
  stolen_funds: "Stolen funds",
  ransomware: "Ransomware",
  darknet: "Darknet market",
  mixer: "Mixer",
  scam: "Scam",
  high_risk_exchange: "High-risk exchange",
  gambling: "Gambling",
  defi: "DeFi protocol",
  bridge: "Bridge",
  exchange: "Exchange",
  anchor: "Anchor",
  issuer: "Asset issuer",
};

/** Risky categories: everything that should raise a score rather than reassure. */
export function isRiskCategory(category: LabelCategory): boolean {
  return CATEGORY_SEVERITY[category] >= 40;
}

function lookupKey(chain: ChainId, address: string): string {
  // EVM addresses are case-insensitive; Stellar strkeys are case-sensitive.
  return chain === "stellar" ? `stellar:${address}` : `${chain}:${address.toLowerCase()}`;
}

export interface LabelIndex {
  get(chain: ChainId, address: string): Label[];
  size: number;
}

export function createLabelIndex(labels: Label[]): LabelIndex {
  const map = new Map<string, Label[]>();
  for (const label of labels) {
    const key = lookupKey(label.chain, label.address);
    const existing = map.get(key);
    if (existing) existing.push(label);
    else map.set(key, [label]);
  }
  return {
    get: (chain, address) => map.get(lookupKey(chain, address)) ?? [],
    size: labels.length,
  };
}
