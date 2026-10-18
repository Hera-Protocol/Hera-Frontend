"use client";

import { Building2, Wallet } from "lucide-react";
import type { RefObject } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/cn";
import { TextField } from "./fields";
import { emptyVasp, type TravelRuleFormValues, type VaspForm } from "./form";
import { SubjectField } from "./subject-field";

/** Originator and beneficiary accounts, and who holds the beneficiary's wallet. */
export function AccountsStep({ savedVasp }: { savedVasp: RefObject<VaspForm | null> }) {
  const { control, setValue, getValues } = useFormContext<TravelRuleFormValues>();
  const vasp = useWatch({ control, name: "beneficiaryVasp" });
  const direction = useWatch({ control, name: "direction" });
  const hosted = vasp !== null;

  const choose = (next: "vasp" | "unhosted") => {
    if (next === "vasp" && !hosted) setValue("beneficiaryVasp", savedVasp.current ?? emptyVasp(), { shouldDirty: true });
    if (next === "unhosted" && hosted) {
      // Keep what was typed, in case they switch back.
      savedVasp.current = getValues("beneficiaryVasp");
      setValue("beneficiaryVasp", null, { shouldDirty: true });
    }
  };

  const option = (value: "vasp" | "unhosted", title: string, body: string, Icon: typeof Wallet) => {
    const on = (value === "vasp") === hosted;
    return (
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-[14px] border-2 border-line p-3.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-iris",
          on ? "bg-sun text-[#17130F] shadow-hard-sm" : "bg-card hover:bg-paper",
        )}
      >
        <input type="radio" name="vasp-mode" checked={on} onChange={() => choose(value)} className="mt-1 size-[18px] accent-[#17130F]" />
        <span className="flex flex-col gap-0.5">
          <strong className="flex items-center gap-2 text-base">
            <Icon aria-hidden className="size-4" /> {title}
          </strong>
          <span className={cn("text-[13px]", !on && "text-ink-soft")}>{body}</span>
        </span>
      </label>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SubjectField
          name="originatorAccount"
          label="Originator account"
          hint={direction === "outgoing" ? "Where your customer's funds leave from." : "The sender's address."}
        />
        <SubjectField
          name="beneficiaryAccount"
          label="Beneficiary account"
          hint={direction === "outgoing" ? "The destination address." : "Your customer's receiving address."}
        />
      </div>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">Who holds the beneficiary&apos;s wallet?</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {option("vasp", "VASP", "An exchange, anchor or custodian. They receive the IVMS101 data.", Building2)}
          {option("unhosted", "Self-hosted wallet", "The customer holds the keys. No counterparty to message.", Wallet)}
        </div>
      </fieldset>

      {hosted ? (
        <div className="grid grid-cols-1 gap-3 rounded-[14px] border-2 border-line bg-paper p-3.5 sm:grid-cols-3">
          <TextField name="beneficiaryVasp.name" label="VASP name" placeholder="Example Anchor Ltd" autoComplete="off" className="sm:col-span-3" />
          <TextField name="beneficiaryVasp.domain" label="Domain (optional)" placeholder="anchor.example" mono autoComplete="off" className="sm:col-span-2" />
          <TextField name="beneficiaryVasp.lei" label="LEI (optional)" placeholder="20 characters" mono autoComplete="off" inputClassName="uppercase" />
        </div>
      ) : (
        <p className="rounded-[14px] border-2 border-line bg-risk-medium-soft p-3.5 text-sm">
          Self-hosted wallets have no VASP to message. Depending on the rulebook and amount, you&apos;ll need proof that your customer controls the
          wallet before settling. The live check shows when.
        </p>
      )}
    </div>
  );
}
