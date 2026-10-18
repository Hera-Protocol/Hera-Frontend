import type { TravelRuleStatus, TravelRuleTransferDto } from "@hera/core";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

const MAIN: TravelRuleStatus[] = ["draft", "awaiting_counterparty", "acknowledged", "accepted", "settled"];
const UNHOSTED: TravelRuleStatus[] = ["draft", "unhosted_verification", "settled"];

const STEP_LABEL: Record<TravelRuleStatus, string> = {
  draft: "Draft",
  awaiting_counterparty: "Sent",
  acknowledged: "Acknowledged",
  accepted: "Accepted",
  rejected: "Rejected",
  unhosted_verification: "Wallet verification",
  settled: "Settled",
};

/** "10:02" today, "18 Oct, 10:02" otherwise. */
export function shortWhen(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("en", sameDay ? { timeStyle: "short" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

/**
 * The path a transfer can take: the counterparty path, or the self-hosted
 * wallet path once it has entered verification. A rejection replaces the
 * step after the last one reached.
 */
export function trackSteps(t: Pick<TravelRuleTransferDto, "status" | "events">): TravelRuleStatus[] {
  const visited = new Set(t.events.map((e) => e.status));
  const path = visited.has("unhosted_verification") || t.status === "unhosted_verification" ? UNHOSTED : MAIN;
  if (t.status !== "rejected") return path;
  const reached = path.reduce((last, s, i) => (visited.has(s) ? i : last), 0);
  return [...path.slice(0, reached + 1), "rejected"];
}

export function StatusTrack({ transfer }: { transfer: TravelRuleTransferDto }) {
  const steps = trackSteps(transfer);
  const current = steps.indexOf(transfer.status);
  const final = transfer.status === "settled" || transfer.status === "rejected";
  const counterparty = transfer.beneficiaryVasp?.domain || transfer.beneficiaryVasp?.name || "the counterparty";
  const eventFor = (s: TravelRuleStatus) => [...transfer.events].reverse().find((e) => e.status === s);

  const pendingHint: Partial<Record<TravelRuleStatus, string>> = {
    awaiting_counterparty: `to ${counterparty}`,
    acknowledged: `by ${counterparty}`,
    accepted: "or rejected",
    unhosted_verification: "proof of control",
    settled: "attach tx hash",
  };

  return (
    <ol aria-label="Status" className="brutal grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5 p-[18px]">
      {steps.map((s, i) => {
        const event = eventFor(s);
        const done = i < current || (final && i === current && s === "settled");
        const active = i === current && !done;
        const rejected = s === "rejected";
        return (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex flex-col gap-1 rounded-[12px] px-3 py-2.5",
              done && "bg-ink text-paper",
              active && !rejected && "border-2 border-line bg-iris text-white shadow-hard-sm dark:text-paper",
              rejected && "border-2 border-line bg-risk-severe-soft text-risk-severe shadow-hard-sm",
              !done && !active && !rejected && "border-2 border-dashed border-line",
            )}
          >
            <strong className="flex items-center gap-1.5 text-sm">
              {i + 1} · {STEP_LABEL[s]}
              {done && <Check aria-hidden strokeWidth={3} className="size-3.5" />}
              {rejected && <X aria-hidden strokeWidth={3} className="size-3.5" />}
            </strong>
            <span className={cn("text-xs", done ? "opacity-85" : !active && !rejected && "text-ink-soft")}>
              {event ? shortWhen(event.at) : pendingHint[s] ?? ""}
              {active && event && s !== "draft" ? " · in progress" : ""}
            </span>
            <span className="sr-only">{done ? "done" : active ? "current step" : rejected ? "rejected" : "not reached"}</span>
          </li>
        );
      })}
    </ol>
  );
}
