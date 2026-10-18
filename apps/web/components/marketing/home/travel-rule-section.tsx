import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Reveal, Stagger, StaggerItem } from "../motion";
import { SectionHeading } from "../section";
import { ThresholdChecker } from "./threshold-checker";

const STEPS = [
  { label: "Draft", state: "done" },
  { label: "Sent", state: "current" },
  { label: "Acknowledged", state: "todo" },
  { label: "Accepted", state: "todo" },
  { label: "Settled", state: "todo" },
] as const;

/** A static illustration of one IVMS101 transfer record. */
function IvmsCard() {
  return (
    <Reveal
      delay={0.1}
      className="flex min-w-0 flex-col gap-[18px] rounded-[18px] border-2 border-line bg-card p-5 shadow-[8px_8px_0_var(--blush)] sm:p-6"
      role="img"
      aria-label="Illustrative Travel Rule record TR-7F3K2Q: Ada Okafor sends 2,500 USDC on Stellar to Lena Fischer via anchor.example. The EU rule applies. Status: sent, awaiting the counterparty."
    >
      <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden>
        <span className="font-mono text-sm font-medium">TR-7F3K2Q</span>
        <span className="rounded-full border-2 border-line bg-iris-soft px-3 py-0.5 text-[13px] font-bold">Awaiting counterparty</span>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2" aria-hidden>
        {[
          { role: "ORIGINATOR", name: "Ada Okafor", detail: "Customer ID c-10293 · NG" },
          { role: "BENEFICIARY", name: "Lena Fischer", detail: "via anchor.example · DE" },
        ].map((p) => (
          <div key={p.role} className="flex flex-col gap-1 rounded-[12px] border-2 border-line bg-paper p-3.5">
            <span className="font-mono text-[11px] tracking-[0.1em] text-ink-soft">{p.role}</span>
            <span className="font-bold">{p.name}</span>
            <span className="text-[13px] text-ink-soft">{p.detail}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-3 text-[15px]" aria-hidden>
        <span className="text-ink-soft">Amount</span>
        <span className="font-mono font-medium">2,500.00 USDC · Stellar</span>
      </div>
      <div className="rounded-[12px] border-2 border-line bg-sun/25 px-3.5 py-3 text-sm leading-normal" aria-hidden>
        <strong>EU rule applies:</strong> originator and beneficiary data required for every transfer.
      </div>
      <Stagger as="ol" className="flex flex-wrap gap-1.5 text-[13px] font-semibold" aria-hidden>
        {STEPS.map((s) => (
          <StaggerItem
            as="li"
            key={s.label}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border-2 px-3 py-[3px]",
              s.state === "done" && "border-line bg-ink text-paper",
              s.state === "current" && "border-line bg-iris text-paper",
              s.state === "todo" && "border-dashed border-line",
            )}
          >
            {s.label}
            {s.state === "done" && <Check className="size-3.5" strokeWidth={3} />}
          </StaggerItem>
        ))}
      </Stagger>
    </Reveal>
  );
}

export function TravelRuleSection() {
  return (
    <section id="travel-rule" aria-labelledby="travel-rule-title" className="scroll-mt-16 border-y-2 border-line bg-paper-2">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <SectionHeading
            id="travel-rule-title"
            eyebrow="Travel Rule"
            title="Travel Rule, without the spreadsheet."
            lede="Collect IVMS101 originator and beneficiary data, check it against the right jurisdiction's threshold, find the counterparty VASP, and track the message to settlement."
          />
          <Reveal delay={0.05}>
            <ThresholdChecker />
          </Reveal>
        </div>
        <div className="min-w-0 flex-1 lg:sticky lg:top-24">
          <IvmsCard />
        </div>
      </div>
    </section>
  );
}
