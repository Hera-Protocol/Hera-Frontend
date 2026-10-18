"use client";

import type { AlertDto } from "@hera/core";
import { cn } from "@/lib/cn";
import { chainName, shortSubject } from "@/lib/hooks/monitor";
import { SEVERITY_DOT } from "@/lib/risk";

export const SEVERITY_BAR: Record<AlertDto["severity"], string> = {
  low: "border-l-risk-low",
  medium: "border-l-risk-medium",
  high: "border-l-risk-high",
  critical: "border-l-risk-severe",
};

export const SEVERITY_TEXT: Record<AlertDto["severity"], string> = {
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
  critical: "text-risk-severe",
};

export function SeverityDot({ severity, className }: { severity: AlertDto["severity"]; className?: string }) {
  return (
    <span className={cn("size-3 shrink-0 rounded-full border-2 border-line", SEVERITY_DOT[severity], className)} aria-hidden />
  );
}

/** "Treasury hot wallet · Ethereum" or the short subject when it isn't a watched wallet. */
export function alertContext(alert: AlertDto): string {
  return `${alert.walletLabel ?? shortSubject(alert.subjectDisplay)} · ${chainName(alert.chain)}`;
}

/** Compact "4m", "1h", "3d". */
export function shortAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
