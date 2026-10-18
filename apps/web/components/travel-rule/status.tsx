import type { IvmsPerson, TravelRuleStatus, TravelRuleTransferDto } from "@hera/core";
import { shortAddress, subjectAddress } from "@hera/core";
import { Pill } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "iris" | "peacock" | "medium" | "low" | "severe";

export const STATUS_META: Record<TravelRuleStatus, { label: string; tone: Tone; dot: string; tile: string }> = {
  draft: { label: "Draft", tone: "neutral", dot: "bg-ink", tile: "bg-card" },
  awaiting_counterparty: { label: "Awaiting counterparty", tone: "iris", dot: "bg-iris", tile: "bg-iris-soft" },
  acknowledged: { label: "Acknowledged", tone: "peacock", dot: "bg-peacock", tile: "bg-peacock-soft" },
  accepted: { label: "Accepted", tone: "low", dot: "bg-risk-low", tile: "bg-risk-low-soft" },
  rejected: { label: "Rejected", tone: "severe", dot: "bg-risk-severe", tile: "bg-risk-severe-soft" },
  unhosted_verification: { label: "Proof of control needed", tone: "medium", dot: "bg-risk-medium", tile: "bg-risk-medium-soft" },
  settled: { label: "Settled", tone: "low", dot: "bg-risk-low", tile: "bg-risk-low-soft" },
};

/** Button label for moving a transfer *to* a status. */
export const TRANSITION_LABEL: Record<TravelRuleStatus, string> = {
  draft: "Back to draft",
  awaiting_counterparty: "Mark sent",
  acknowledged: "Mark acknowledged",
  accepted: "Mark accepted",
  rejected: "Mark rejected",
  unhosted_verification: "Start wallet verification",
  settled: "Mark settled",
};

/** One line on what the transition means, shown in its dialog. */
export const TRANSITION_HELP: Record<TravelRuleStatus, string> = {
  draft: "Move the transfer back to draft.",
  awaiting_counterparty: "The IVMS101 data has gone to the beneficiary VASP. You're now waiting for them to acknowledge it.",
  acknowledged: "The counterparty confirmed they received the IVMS101 data.",
  accepted: "The counterparty accepted the transfer. You can settle on-chain next.",
  rejected: "The transfer won't go ahead. This is final: a rejected transfer can't be reopened.",
  unhosted_verification: "The beneficiary is a self-hosted wallet. Collect proof that your customer controls it (a signed message) before settling.",
  settled: "The transfer is settled on-chain. This closes it.",
};

export function TravelRuleStatusPill({ status, className }: { status: TravelRuleStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Pill tone={meta.tone} className={className}>
      {meta.label}
    </Pill>
  );
}

export function personName(person: IvmsPerson | undefined | null): string {
  if (!person) return "Unknown";
  if (person.type === "legal") return person.legalName || "Unnamed entity";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "Unnamed person";
}

/** "anchor.example" for a VASP, "unhosted · GBXK…Q2LM" for a self-hosted wallet. */
export function counterpartyLine(t: Pick<TravelRuleTransferDto, "beneficiaryVasp" | "beneficiaryAccount">): string {
  if (t.beneficiaryVasp) return [t.beneficiaryVasp.name, t.beneficiaryVasp.domain].filter(Boolean).join(" · ");
  return `unhosted · ${shortAddress(subjectAddress(t.beneficiaryAccount), 4, 4)}`;
}

export function chainName(chain: string): string {
  return chain === "stellar" ? "Stellar" : chain === "evm:1" ? "Ethereum" : chain;
}

export function StatusDot({ status, className }: { status: TravelRuleStatus; className?: string }) {
  return <span aria-hidden className={cn("mt-1 size-3.5 shrink-0 rounded-full border-2 border-line", STATUS_META[status].dot, className)} />;
}

/** Settlement tx hashes are recorded in transition notes as "Tx hash: …" (the transition body has no field for it). */
export const TX_NOTE_PREFIX = "Tx hash: ";

export function txHashFromEvents(t: TravelRuleTransferDto): string | undefined {
  if (t.txHash) return t.txHash;
  for (const e of [...t.events].reverse()) {
    const line = e.note?.split("\n").find((l) => l.startsWith(TX_NOTE_PREFIX));
    if (line) return line.slice(TX_NOTE_PREFIX.length).trim();
  }
  return undefined;
}
