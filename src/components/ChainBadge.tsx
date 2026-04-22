import type { Chain } from "@/data/mock";

export function ChainBadge({ chain }: { chain: Chain }) {
  const isZcash = chain === "Zcash";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] font-medium ${
        isZcash ? "bg-zcash/15 text-zcash" : "bg-namada/15 text-namada"
      }`}
    >
      {chain}
    </span>
  );
}
