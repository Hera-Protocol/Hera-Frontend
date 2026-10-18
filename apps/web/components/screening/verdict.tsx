"use client";

import { type RiskBand, type ScreeningResult, shortAddress, type SubjectRef } from "@hera/core";
import type { ReactNode } from "react";
import { Argus, type ArgusMood } from "@/components/brand/argus";
import { Tag } from "@/components/ui/badge";
import { ScoreDial } from "@/components/ui/score-dial";
import { Stamp } from "@/components/ui/stamp";
import { cn } from "@/lib/cn";
import { chainName } from "@/lib/hooks/monitor";
import { BAND_STYLE } from "@/lib/risk";

const MOOD: Record<RiskBand, ArgusMood> = { low: "happy", medium: "idle", high: "idle", severe: "alarmed" };

const HEADLINE: Record<RiskBand, string> = {
  low: "Clear to transact",
  medium: "Fine for now, keep watching",
  high: "Review before you credit",
  severe: "Do not transact",
};

/** Headline and one-line summary derived from the actual reasons. */
export function verdictCopy(result: ScreeningResult): { headline: string; summary: string } {
  const scored = [...result.reasons].filter((r) => r.points > 0).sort((a, b) => b.points - a.points);
  const top = scored[0];
  const noHistory = result.reasons.find((r) => r.code === "NO_HISTORY");
  const known = result.reasons.find((r) => r.code === "KNOWN_ENTITY");
  const sub = result.reasons.find((r) => r.code === "SUBACCOUNT_RESOLVED");

  if (result.decision === "block" && result.reasons.some((r) => r.code === "SANCTIONS_DIRECT")) {
    return { headline: "Do not transact", summary: result.reasons.find((r) => r.code === "SANCTIONS_DIRECT")!.detail };
  }
  if (top) return { headline: HEADLINE[result.band], summary: top.detail };
  if (noHistory && result.band === "low") {
    return { headline: "Nothing to go on yet", summary: noHistory.detail };
  }
  const parts = [`No risky counterparties or behavior in the ${result.stats.transfers} transfers Hera read.`];
  if (sub) parts.unshift(sub.detail);
  else if (known) parts.push(known.detail);
  return { headline: HEADLINE[result.band], summary: parts.join(" ") };
}

export function VerdictCard({ result, children }: { result: ScreeningResult; children?: ReactNode }) {
  const style = BAND_STYLE[result.band];
  const { headline, summary } = verdictCopy(result);
  return (
    <section
      aria-labelledby="verdict-headline"
      className={cn("flex flex-col gap-[18px] rounded-[18px] border-2 border-line p-5 shadow-hard-lg sm:p-[22px]", style.soft)}
    >
      <div className="flex flex-wrap items-center gap-5">
        <ScoreDial score={result.score} band={result.band} />
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
          <span className="eyebrow !text-ink">
            {chainName(result.subject.chain)} · {style.label} risk · {result.decision}
          </span>
          <h2 id="verdict-headline" className="text-[30px] leading-[1.05] font-extrabold">
            {headline}
          </h2>
          <p className="text-[15px] leading-relaxed text-ink-soft">{summary}</p>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Argus mood={MOOD[result.band]} size={96} title={`Argus looks ${MOOD[result.band] === "alarmed" ? "alarmed" : MOOD[result.band] === "happy" ? "happy" : "watchful"}`} />
          <Stamp tone={result.band}>{style.stamp}</Stamp>
        </div>
      </div>
      <DecodeStrip subject={result.subject} />
      {children && <div className="flex flex-wrap gap-2.5">{children}</div>}
    </section>
  );
}

/** Shows how a muxed or memo subject was decoded. Renders nothing for a plain account. */
export function DecodeStrip({ subject }: { subject: SubjectRef }) {
  if (subject.chain !== "stellar" || !subject.sub) return null;
  const muxed = subject.sub.kind === "muxed";
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border-2 border-dashed border-line bg-paper px-3.5 py-3 text-sm">
      <Tag tone="iris">{muxed ? "SEP-23 decoded" : "Memo sub-account"}</Tag>
      <span>Account</span>
      <span className="font-mono font-medium" title={subject.account}>
        {shortAddress(subject.account)}
      </span>
      <span className="text-ink-soft" aria-hidden>
        +
      </span>
      <span>{muxed ? "muxed ID" : `memo ${subject.sub.kind === "memo" ? subject.sub.type : ""}`}</span>
      <span className="rounded-lg border-2 border-line bg-sun px-2 font-mono font-medium break-all text-[#17130F]">
        {subject.sub.kind === "muxed" ? subject.sub.id : subject.sub.value}
      </span>
    </div>
  );
}
