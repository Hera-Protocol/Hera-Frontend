"use client";

import { getJurisdiction } from "@hera/core";
import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/format";
import { liveCheck, parseAccount, type TravelRuleFormValues } from "./form";

type ItemState = "ok" | "missing" | "na";
interface Item {
  label: string;
  state: ItemState;
}

function identifierLabel(v: TravelRuleFormValues): string {
  const p = v.originator;
  if (p.customerId.trim()) return "Originator identifier (customer ID)";
  if (p.address.country && (p.address.city.trim() || p.address.street.trim())) return "Originator identifier (address)";
  if (p.type === "natural" && p.nationalId.trim()) return "Originator identifier (national ID)";
  if (p.type === "natural" && p.dateOfBirth && p.placeOfBirth.trim()) return "Originator identifier (date and place of birth)";
  return "Originator identifier";
}

function hasName(p: TravelRuleFormValues["originator"]) {
  return p.type === "natural" ? Boolean(p.firstName.trim() && p.lastName.trim()) : Boolean(p.legalName.trim());
}

/**
 * Recomputed on every keystroke from core's `checkTravelRule` and
 * `originatorHasIdentifier`: the same functions the API runs on create.
 */
export function LiveCheckPanel({ values }: { values: TravelRuleFormValues }) {
  const { check, usd, hasIdentifier } = liveCheck(values);
  const jurisdiction = getJurisdiction(values.jurisdiction);
  const hosted = values.beneficiaryVasp !== null;
  const beneficiary = parseAccount(values.beneficiaryAccount, values.chain);
  const originatorAccount = parseAccount(values.originatorAccount, values.chain);
  const sub = beneficiary?.ok && beneficiary.subject.chain === "stellar" ? beneficiary.subject.sub : undefined;
  const missing: ItemState = check.required ? "missing" : "na";

  const items: Item[] = [
    { label: "Originator name", state: hasName(values.originator) ? "ok" : missing },
    { label: identifierLabel(values), state: hasIdentifier ? "ok" : missing },
    { label: "Originator account", state: originatorAccount?.ok ? "ok" : missing },
    { label: "Beneficiary name and account", state: hasName(values.beneficiary) && beneficiary?.ok ? "ok" : missing },
  ];
  if (sub) items.push({ label: sub.kind === "muxed" ? `Sub-account resolved (muxed ID ${sub.id})` : `Sub-account resolved (memo ${sub.value})`, state: "ok" });
  if (hosted) items.push({ label: "Beneficiary VASP name", state: values.beneficiaryVasp?.name.trim() ? "ok" : missing });

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Live Travel Rule check"
        className={cn(
          "flex flex-col gap-3.5 rounded-[18px] border-2 border-line p-5 shadow-hard-lg",
          check.required ? "bg-risk-medium-soft" : "bg-peacock-soft",
        )}
      >
        <span className="self-start rounded-md bg-ink px-2 py-0.5 font-mono text-xs tracking-[0.1em] text-paper">LIVE CHECK</span>
        <h2 aria-live="polite" className="text-[26px] leading-[1.05] font-extrabold">{check.required ? "Travel Rule applies" : "Below the threshold"}</h2>
        <p className="text-[15px] leading-relaxed">{check.explanation}</p>
        <p className="font-mono text-xs text-ink-soft">
          {jurisdiction.reference} · threshold {formatUsd(check.thresholdUsd)}
          {usd === null ? " · enter a USD value to confirm" : ` · this transfer ${formatUsd(usd)}`}
        </p>
        <ul className="flex flex-col gap-2 text-sm" aria-label={check.required ? "Required data" : "Recommended data"}>
          {items.map((item) => (
            <CheckItem key={item.label} {...item} />
          ))}
          {hosted ? (
            <CheckItem label="Proof of wallet control: not needed (hosted)" state="na" />
          ) : check.unhostedProofRequired ? (
            <CheckItem label="Proof of wallet control: required for this self-hosted wallet" state="missing" />
          ) : (
            <CheckItem label="Proof of wallet control: not required at this amount" state="na" />
          )}
        </ul>
      </section>

      <section className="brutal flex flex-col gap-3 p-[18px]">
        <h3 className="text-lg font-bold">What happens next</h3>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-normal">
          <li>Hera saves the transfer as a draft, with this rule check attached.</li>
          {hosted ? (
            <>
              <li>Send the IVMS101 data to {values.beneficiaryVasp?.name.trim() || "the beneficiary VASP"} and mark it sent.</li>
              <li>Record their acknowledgement, then their acceptance or rejection.</li>
            </>
          ) : (
            <li>Verify your customer controls the self-hosted wallet, with a signed message.</li>
          )}
          <li>Settle on-chain and attach the transaction hash.</li>
          <li>Export a Travel Rule record PDF at any point.</li>
        </ol>
      </section>
    </div>
  );
}

function CheckItem({ label, state }: Item) {
  const Icon = state === "ok" ? Check : state === "missing" ? X : Minus;
  return (
    <li className="flex gap-2.5">
      <Icon
        aria-hidden
        strokeWidth={3}
        className={cn("mt-0.5 size-4 shrink-0", state === "ok" ? "text-risk-low" : state === "missing" ? "text-risk-severe" : "text-ink-soft")}
      />
      <span className={cn(state === "na" && "text-ink-soft")}>
        {label}
        <span className="sr-only">{state === "ok" ? ": done" : state === "missing" ? ": missing" : ": optional"}</span>
      </span>
    </li>
  );
}
