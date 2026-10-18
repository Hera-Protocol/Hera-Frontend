import type { FetchLike } from "@hera/core";

/** Ronin Bridge exploiter, on the OFAC SDN list and in SEED_LABELS. */
export const SANCTIONED = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";
/** An unlabelled address whose only activity is a deposit into Tornado Cash. */
export const MIXER_USER = "0x1111111111111111111111111111111111111111";
export const TORNADO_ROUTER = "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b";
export const MIXER_TX = `0x${"ab".repeat(32)}`;

interface EvmFixture {
  transactions: unknown[];
}

const tx = (hash: string, from: string, to: string, timestamp: string, valueWei: string) => ({
  hash,
  timestamp,
  from: { hash: from },
  to: { hash: to },
  value: valueWei,
  status: "ok",
});

const EVM: Record<string, EvmFixture> = {
  [SANCTIONED.toLowerCase()]: {
    transactions: [tx(`0x${"01".repeat(32)}`, SANCTIONED, "0x2222222222222222222222222222222222222222", "2026-10-01T12:00:00.000Z", "1000000000000000000")],
  },
  [MIXER_USER.toLowerCase()]: {
    transactions: [tx(MIXER_TX, MIXER_USER, TORNADO_ROUTER, "2026-10-10T08:00:00.000Z", "100000000000000000")],
  },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const page = (items: unknown[]) => json({ items, next_page_params: null });

export interface ChainStub {
  fetch: FetchLike;
  calls: string[];
  /** Make every request fail as if the data source were down. */
  outage: boolean;
}

/** Answers Blockscout v2 and Horizon URLs from fixtures; unknown accounts are 404, like the real APIs. */
export function createChainStub(): ChainStub {
  const stub: ChainStub = {
    calls: [],
    outage: false,
    fetch: async (input) => {
      const url = new URL(input);
      stub.calls.push(url.toString());
      if (stub.outage) return json({ message: "unavailable" }, 503);

      const evm = /^\/api\/v2\/addresses\/(0x[0-9a-fA-F]{40})(?:\/([a-z-]+))?$/.exec(url.pathname);
      if (evm) {
        const fixture = EVM[evm[1]!.toLowerCase()];
        if (!fixture) return json({ message: "Not found" }, 404);
        switch (evm[2]) {
          case undefined:
            return json({ hash: evm[1], coin_balance: "0", is_contract: false, ens_domain_name: null });
          case "transactions":
            return page(fixture.transactions);
          default:
            return page([]);
        }
      }
      // Horizon: no Stellar fixtures needed, every account is unknown.
      return json({ status: 404 }, 404);
    },
  };
  return stub;
}
