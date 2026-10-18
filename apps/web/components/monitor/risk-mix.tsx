"use client";

import type { RiskBand } from "@hera/core";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { BAND_STYLE } from "@/lib/risk";

const BANDS: RiskBand[] = ["low", "medium", "high", "severe"];

/** Share of all screenings per band, as one segmented bar plus a legend. */
export function RiskMix({ mix }: { mix: Record<RiskBand, number> }) {
  const total = BANDS.reduce((n, b) => n + mix[b], 0);
  const pct = (b: RiskBand) => (total ? (mix[b] / total) * 100 : 0);
  const label = (b: RiskBand) => {
    const p = pct(b);
    return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
  };
  const summary = total ? BANDS.map((b) => `${BAND_STYLE[b].label} ${label(b)}`).join(", ") : "No screenings yet";
  const visible = BANDS.filter((b) => mix[b] > 0);
  return (
    <div className="flex flex-col gap-4">
      <div role="img" aria-label={`Risk mix of all screenings: ${summary}`} className="flex h-[30px] overflow-hidden rounded-[10px] border-2 border-line bg-paper-2">
        {visible.map((b, i) => (
          <motion.div
            key={b}
            className={cn(BAND_STYLE[b].solid, i > 0 && "border-l-2 border-line")}
            initial={{ width: 0 }}
            animate={{ width: `${pct(b)}%` }}
            transition={{ duration: 0.7, ease: [0.2, 0, 0, 1], delay: i * 0.05 }}
            style={{ minWidth: 6 }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2.5 text-sm">
        {BANDS.map((b) => (
          <li key={b} className="flex items-center gap-2">
            <span className={cn("size-3 rounded-[3px] border-2 border-line", BAND_STYLE[b].solid)} aria-hidden />
            {BAND_STYLE[b].label}
            <strong className="ml-auto font-mono font-medium">
              {total ? label(b) : "–"}
              <span className="sr-only"> ({mix[b]} screenings)</span>
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
