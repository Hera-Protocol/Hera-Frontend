"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Segmented } from "@/components/ui/misc";
import { CountryOptions, SelectField, TextField } from "./fields";
import type { TravelRuleFormValues } from "./form";

/**
 * IVMS101 person (natural or legal). The originator shows its identifiers up
 * front, since FATF R.16 needs one; the beneficiary tucks them away.
 */
export function PersonFieldset({
  role,
  ours,
  identifierError,
}: {
  role: "originator" | "beneficiary";
  /** Whether this party is your customer (depends on direction). */
  ours: boolean;
  identifierError?: string | null;
}) {
  const { control, setValue } = useFormContext<TravelRuleFormValues>();
  const type = useWatch({ control, name: `${role}.type` });
  const label = role === "originator" ? "Originator" : "Beneficiary";

  const identifiers = (
    <div className="flex flex-col gap-3">
      {type === "natural" && <TextField name={`${role}.nationalId`} label="National ID" mono autoComplete="off" />}
      {type === "natural" && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <TextField name={`${role}.dateOfBirth`} label="Date of birth" type="date" />
          <TextField name={`${role}.placeOfBirth`} label="Place of birth" placeholder="City" autoComplete="off" />
        </div>
      )}
      <TextField name={`${role}.address.street`} label="Street address" autoComplete="off" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <TextField name={`${role}.address.city`} label="City" autoComplete="off" />
        <SelectField name={`${role}.address.country`} label="Country">
          <CountryOptions />
        </SelectField>
      </div>
    </div>
  );

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-[14px] border-2 border-line bg-paper p-3.5">
      <legend className="px-1.5 font-mono text-xs tracking-[0.1em] uppercase">
        {label} · {type === "natural" ? "natural person" : "legal person"}
      </legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-ink-soft">{ours ? "Your customer" : "The counterparty's customer"}</span>
        <Segmented
          label={`${label} type`}
          value={type}
          onChange={(v) => setValue(`${role}.type`, v, { shouldDirty: true })}
          options={[
            { value: "natural", label: "Person" },
            { value: "legal", label: "Company" },
          ]}
        />
      </div>

      {type === "natural" ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <TextField name={`${role}.firstName`} label="First name" placeholder="First name" autoComplete="off" />
          <TextField name={`${role}.lastName`} label="Last name" placeholder="Last name" autoComplete="off" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <TextField name={`${role}.legalName`} label="Legal name" placeholder="Example Anchor Ltd" autoComplete="off" />
          <TextField
            name={`${role}.lei`}
            label="LEI (optional)"
            placeholder="20 characters"
            mono
            maxLength={20}
            autoComplete="off"
            inputClassName="uppercase"
          />
        </div>
      )}
      <TextField name={`${role}.customerId`} label="Customer ID" placeholder="c-12345" mono autoComplete="off" />

      {role === "originator" ? (
        <>
          <p className="text-[13px] text-ink-soft">
            Above the threshold, the originator needs one identifier: customer ID, national ID, address, or date and place of birth.
          </p>
          {identifierError && (
            <p role="alert" className="rounded-[10px] border-2 border-line bg-risk-severe-soft px-3 py-2 text-[13px] font-medium text-risk-severe">
              {identifierError}
            </p>
          )}
          {identifiers}
        </>
      ) : (
        <details className="group rounded-[10px] border-2 border-dashed border-line/50 px-3 py-2">
          <summary className="min-h-8 cursor-pointer py-1 text-sm font-semibold">More details (optional)</summary>
          <div className="pt-2 pb-1">{identifiers}</div>
        </details>
      )}
    </fieldset>
  );
}
