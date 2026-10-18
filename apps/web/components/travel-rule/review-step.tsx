"use client";

import { getJurisdiction } from "@hera/core";
import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { countryName } from "./countries";
import { formatAmount, formatUsd } from "@/lib/format";
import { cleanNumber, parseAccount, parseUsd, type PersonForm, type TravelRuleFormValues } from "./form";
import { chainName } from "./status";
import { SubjectSummary } from "./subject-field";

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function PersonRows({ p }: { p: PersonForm }) {
  const address = [p.address.street, p.address.city, p.address.country && countryName(p.address.country)].filter((s) => s && s.trim()).join(", ");
  return (
    <>
      <Row label="Type">{p.type === "natural" ? "Natural person" : "Legal person"}</Row>
      <Row label="Name">{p.type === "natural" ? [p.firstName, p.lastName].join(" ").trim() || "—" : p.legalName || "—"}</Row>
      {p.type === "legal" && <Row label="LEI">{p.lei ? <span className="font-mono">{p.lei.toUpperCase()}</span> : null}</Row>}
      <Row label="Customer ID">{p.customerId ? <span className="font-mono">{p.customerId}</span> : null}</Row>
      {p.type === "natural" && <Row label="National ID">{p.nationalId ? <span className="font-mono">{p.nationalId}</span> : null}</Row>}
      {p.type === "natural" && <Row label="Born">{[p.dateOfBirth, p.placeOfBirth].filter(Boolean).join(", ") || null}</Row>}
      <Row label="Address">{address || null}</Row>
    </>
  );
}

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (step: number) => void; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-[14px] border-2 border-line bg-paper p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="eyebrow !text-ink">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-bold hover:bg-paper-2"
          aria-label={`Edit ${title.toLowerCase()}`}
        >
          <Pencil aria-hidden className="size-3.5" /> Edit
        </button>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-1.5 text-sm">{children}</dl>
    </section>
  );
}

export function ReviewStep({ values, onEdit }: { values: TravelRuleFormValues; onEdit: (step: number) => void }) {
  const originator = parseAccount(values.originatorAccount, values.chain);
  const beneficiary = parseAccount(values.beneficiaryAccount, values.chain);
  const usd = parseUsd(values.amountUsd);
  const amount = cleanNumber(values.amount);
  const j = getJurisdiction(values.jurisdiction);
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      <Section title="Originator" step={0} onEdit={onEdit}>
        <PersonRows p={values.originator} />
      </Section>
      <Section title="Beneficiary" step={0} onEdit={onEdit}>
        <PersonRows p={values.beneficiary} />
      </Section>
      <Section title="Accounts" step={1} onEdit={onEdit}>
        <Row label="From">{originator?.ok ? <SubjectSummary subject={originator.subject} /> : "—"}</Row>
        <Row label="To">{beneficiary?.ok ? <SubjectSummary subject={beneficiary.subject} /> : "—"}</Row>
        <Row label="VASP">
          {values.beneficiaryVasp
            ? [values.beneficiaryVasp.name, values.beneficiaryVasp.domain, values.beneficiaryVasp.lei && `LEI ${values.beneficiaryVasp.lei.toUpperCase()}`]
                .filter(Boolean)
                .join(" · ")
            : "Self-hosted wallet"}
        </Row>
      </Section>
      <Section title="Amount" step={2} onEdit={onEdit}>
        <Row label="Direction">{values.direction === "outgoing" ? "Outgoing" : "Incoming"}</Row>
        <Row label="Amount">
          <span className="font-mono">
            {amount ? formatAmount(amount, 7) : "—"} {values.asset.toUpperCase()}
          </span>{" "}
          on {chainName(values.chain)}
        </Row>
        <Row label="USD value">{usd === null ? "—" : formatUsd(usd)}</Row>
        <Row label="Rulebook">
          {j.name} ({j.code})
        </Row>
        <Row label="Tx hash">{values.txHash.trim() ? <span className="font-mono break-all">{values.txHash.trim()}</span> : null}</Row>
      </Section>
    </div>
  );
}
