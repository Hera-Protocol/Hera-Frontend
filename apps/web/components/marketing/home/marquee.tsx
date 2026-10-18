import { Sparkle } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/cn";

const ITEMS: { label: string; soon?: boolean }[] = [
  { label: "Stellar" },
  { label: "Ethereum" },
  { label: "USDC" },
  { label: "EURC" },
  { label: "XLM" },
  { label: "ETH" },
  { label: "USDT" },
  { label: "Base", soon: true },
  { label: "Arbitrum", soon: true },
  { label: "Polygon", soon: true },
];

function Track({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {ITEMS.map((item) => (
        <Fragment key={item.label}>
          <li className={cn(item.soon && "opacity-60")}>
            {item.label}
            {item.soon && <span className="sr-only">, coming soon</span>}
            {item.soon && <span aria-hidden> · soon</span>}
          </li>
          <li aria-hidden className="text-sun">
            <Sparkle className="size-5 fill-current" />
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

/** Supported networks and assets, scrolling. Two copies of the track make the loop seamless. */
export function Marquee() {
  return (
    <section aria-label="Supported networks and assets" className="overflow-hidden border-y-2 border-line">
      <div data-theme="dark" className="bg-paper py-4 text-ink">
        <div className="flex w-max animate-marquee font-display text-[22px] font-bold whitespace-nowrap hover:[animation-play-state:paused] sm:text-[26px]">
          <Track />
          <Track hidden />
        </div>
      </div>
    </section>
  );
}
