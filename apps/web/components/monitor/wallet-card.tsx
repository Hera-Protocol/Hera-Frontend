"use client";

import { shortAddress, type WalletDto } from "@hera/core";
import Link from "next/link";
import { Tag } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { chainName, subjectBase, subLabel } from "@/lib/hooks/monitor";
import { BAND_STYLE } from "@/lib/risk";

export function ScoreBadge({ wallet, className }: { wallet: WalletDto; className?: string }) {
  if (wallet.lastScore === undefined || !wallet.lastBand) {
    return <span className={cn("rounded-[12px] border-2 border-line bg-paper-2 px-2 py-1 font-mono text-sm text-ink-soft", className)}>n/a</span>;
  }
  const s = BAND_STYLE[wallet.lastBand];
  return (
    <span className={cn("min-w-12 rounded-[12px] border-2 border-line px-2 py-1 text-center font-display text-[22px] leading-tight font-extrabold", s.soft, s.text, className)}>
      {wallet.lastScore}
      <span className="sr-only"> out of 100, {s.label} risk</span>
    </span>
  );
}

export function WalletCard({ wallet }: { wallet: WalletDto }) {
  const risky = wallet.lastBand === "high" || wallet.lastBand === "severe";
  return (
    <Link
      href={`/app/wallets/${wallet.id}`}
      className={cn(
        "press flex w-full flex-col gap-3 rounded-[16px] border-2 border-line bg-card p-4",
        risky ? "shadow-[4px_4px_0_var(--risk-high)]" : "shadow-hard",
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <strong className="truncate text-[17px]">{wallet.label}</strong>
          <span className="font-mono text-[13px]" title={wallet.display}>
            {shortAddress(subjectBase(wallet.subject))}
          </span>
          <span className="text-xs text-ink-soft">{subLabel(wallet.subject) || "address"}</span>
        </div>
        <ScoreBadge wallet={wallet} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Tag tone={wallet.chain === "stellar" ? "ink" : "neutral"}>{chainName(wallet.chain)}</Tag>
        {wallet.customerRef && <Tag className="bg-paper">{wallet.customerRef}</Tag>}
      </div>
      <div className="flex justify-between gap-2 border-t border-dashed border-line/30 pt-2.5 text-[13px] text-ink-soft">
        <span>Activity {timeAgo(wallet.lastActivityAt)}</span>
        <span>Checked {timeAgo(wallet.lastCheckedAt)}</span>
      </div>
    </Link>
  );
}
