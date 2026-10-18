"use client";

import { listChains } from "@hera/core";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useChains } from "@/lib/queries";
import { cn } from "@/lib/cn";
import type { ChainChoice, SubjectCheck } from "@/lib/hooks/monitor";

/** Chain options: detect, then live chains, then the rest disabled as "soon". */
export function useChainOptions() {
  const chains = useChains();
  const known = chains.data ?? listChains().map((c) => ({ id: c.id, name: c.name, live: c.live }));
  const live = known.filter((c) => c.live);
  const soon = known.filter((c) => !c.live);
  return [
    { value: "detect" as ChainChoice, label: "Detect from address", disabled: false },
    ...live.map((c) => ({ value: c.id as ChainChoice, label: c.name, disabled: false })),
    ...soon.map((c) => ({ value: c.id as ChainChoice, label: `${c.name} (soon)`, disabled: true })),
  ];
}

export function ChainOptions() {
  const options = useChainOptions();
  return (
    <>
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </>
  );
}

/** Live decode line under the address field: what Hera understood, or the exact error. */
export function SubjectHint({ check, id, className }: { check: SubjectCheck; id?: string; className?: string }) {
  if (check.state === "empty") return null;
  const ok = check.state === "ok";
  const Icon = ok ? (check.sharedHint ? Info : CheckCircle2) : AlertCircle;
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn(
        "flex items-start gap-1.5 text-[13px] font-medium",
        ok ? (check.sharedHint ? "text-ink-soft" : "text-risk-low") : "text-risk-severe",
        className,
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className={cn(ok && !check.sharedHint && "font-mono")}>{check.message}</span>
    </p>
  );
}
