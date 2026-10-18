import type { Decision, RiskBand } from "@hera/core";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { BAND_STYLE, DECISION_STYLE } from "@/lib/risk";

type Tone = "neutral" | "iris" | "peacock" | "blush" | "sun" | "ink" | "low" | "medium" | "high" | "severe";

const TONES: Record<Tone, string> = {
  neutral: "bg-card text-ink",
  iris: "bg-iris-soft text-ink",
  peacock: "bg-peacock-soft text-ink",
  blush: "bg-blush-soft text-ink",
  sun: "bg-sun text-[#17130F]",
  ink: "bg-ink text-paper",
  low: "bg-risk-low-soft text-risk-low",
  medium: "bg-risk-medium-soft text-risk-medium",
  high: "bg-risk-high-soft text-risk-high",
  severe: "bg-risk-severe-soft text-risk-severe",
};

/** Small mono tag: chain, scope, event type, reason code. */
export function Tag({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md border-2 border-line px-1.5 font-mono text-xs whitespace-nowrap", TONES[tone], className)}
      {...props}
    />
  );
}

/** Rounded status pill: statuses, decisions, roles. */
export function Pill({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border-2 border-line px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap", TONES[tone], className)}
      {...props}
    />
  );
}

export function RiskChip({ band, score, className }: { band: RiskBand; score: number; className?: string }) {
  const s = BAND_STYLE[band];
  return (
    <span className={cn("inline-flex items-center rounded-lg border-2 border-line px-2 py-0.5 font-mono text-[13px] font-medium whitespace-nowrap", s.soft, s.text, className)}>
      {score} · {s.label.toLowerCase()}
    </span>
  );
}

export function DecisionPill({ decision }: { decision: Decision }) {
  return <span className={cn("inline-flex rounded-full border-2 border-line px-2.5 py-0.5 text-[13px] font-bold capitalize", DECISION_STYLE[decision])}>{decision}</span>;
}

export function ChainTag({ chain }: { chain: string }) {
  const name = chain === "stellar" ? "Stellar" : chain === "evm:1" ? "Ethereum" : chain;
  return <Tag tone={chain === "stellar" ? "ink" : "neutral"}>{name}</Tag>;
}
