"use client";

import { type ChainId, type Reason, shortAddress } from "@hera/core";
import { ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { explorerTxUrl } from "@/lib/hooks/monitor";
import { SEVERITY_STYLE } from "@/lib/risk";

export function pointsLabel(points: number) {
  return points > 0 ? `+${points}` : "0";
}

export function PointsChip({ reason, className }: { reason: Pick<Reason, "points" | "severity">; className?: string }) {
  return (
    <span
      className={cn(
        "min-w-[52px] shrink-0 rounded-lg border-2 border-line px-2 py-1 text-center font-mono text-[13px] font-medium",
        SEVERITY_STYLE[reason.severity],
        className,
      )}
    >
      {pointsLabel(reason.points)}
      <span className="sr-only"> points, {reason.severity} severity</span>
    </span>
  );
}

/** Reasons sorted by points, staggering in on reveal. */
export function ReasonsList({ reasons, chain, compact = false }: { reasons: Reason[]; chain: ChainId; compact?: boolean }) {
  const sorted = [...reasons].sort((a, b) => b.points - a.points);
  if (sorted.length === 0) {
    return <p className="px-5 py-6 text-[15px] text-ink-soft">No rules fired. Hera found nothing to flag in the data it read.</p>;
  }
  return (
    <motion.ul
      className="flex flex-col"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}
    >
      {sorted.map((r, i) => {
        const label = r.evidence?.label;
        const txs = r.evidence?.txHashes?.slice(0, 3) ?? [];
        return (
          <motion.li
            key={`${r.code}-${i}`}
            variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } }}
            className={cn("flex items-start gap-3.5 border-dashed border-line/25", compact ? "py-3" : "px-5 py-4", i > 0 && "border-t")}
          >
            <PointsChip reason={r} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <strong className={compact ? "text-[15px]" : "text-base"}>{r.title}</strong>
                <span className="font-mono text-[11px] text-ink-soft">{r.code}</span>
              </div>
              <p className="text-sm leading-relaxed break-words text-ink-soft">{r.detail}</p>
              {(label || txs.length > 0) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  {label && (
                    <span className="text-ink-soft">
                      Source:{" "}
                      {label.sourceUrl ? (
                        <a href={label.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-iris underline-offset-2 hover:underline">
                          {label.source}
                          <ExternalLink className="size-3" aria-hidden />
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        <span className="font-semibold text-ink">{label.source}</span>
                      )}
                    </span>
                  )}
                  {txs.map((hash) => {
                    const url = explorerTxUrl(chain, hash);
                    return url ? (
                      <a key={hash} href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-iris hover:underline">
                        tx {shortAddress(hash, 4, 4)}
                        <span className="sr-only"> (opens explorer)</span>
                      </a>
                    ) : (
                      <span key={hash} className="font-mono text-xs">
                        tx {shortAddress(hash, 4, 4)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
