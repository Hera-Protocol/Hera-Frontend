"use client";

import { shortAddress, type SubjectRef } from "@hera/core";
import { useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Tag } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { useFieldError } from "./fields";
import { parseAccount, type TravelRuleFormValues } from "./form";

/** One line describing what an address decodes to, e.g. "SEP-23 · GBXK…Q2LM + muxed ID 7741". */
export function SubjectSummary({ subject }: { subject: SubjectRef }) {
  if (subject.chain !== "stellar") {
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs font-medium">
        <Tag tone="neutral">EVM</Tag>
        <span className="font-mono break-all">{subject.address}</span>
      </span>
    );
  }
  const account = <span className="font-mono">{shortAddress(subject.account, 4, 4)}</span>;
  if (!subject.sub) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs font-medium">
        <Tag tone="ink">Stellar</Tag>
        {account} · no sub-account
      </span>
    );
  }
  return subject.sub.kind === "muxed" ? (
    <span className="flex flex-wrap items-center gap-2 text-xs font-medium">
      <Tag tone="iris">SEP-23</Tag>
      {account} + muxed ID <span className="font-mono">{subject.sub.id}</span>
    </span>
  ) : (
    <span className="flex flex-wrap items-center gap-2 text-xs font-medium">
      <Tag tone="iris">Memo</Tag>
      {account} + memo {subject.sub.type} <span className="font-mono break-all">{subject.sub.value}</span>
    </span>
  );
}

/**
 * Address + optional memo, decoded live with core's `parseSubject`, so a
 * muxed M… address shows the G… account and id it stands for.
 */
export function SubjectField({ name, label, hint }: { name: "originatorAccount" | "beneficiaryAccount"; label: string; hint?: string }) {
  const { control, register } = useFormContext<TravelRuleFormValues>();
  const account = useWatch({ control, name });
  const chain = useWatch({ control, name: "chain" });
  const addressError = useFieldError(`${name}.address`);
  const memoError = useFieldError(`${name}.memo.value`);
  const parsed = parseAccount(account, chain);
  const decodedId = useId();
  const showMemo = account.address.trim().startsWith("G") || account.memo.value.trim() !== "";

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Field label={label} hint={hint} error={addressError}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            mono
            aria-describedby={[describedBy, decodedId].filter(Boolean).join(" ")}
            aria-invalid={invalid || undefined}
            placeholder="G…, M… or 0x…"
            autoComplete="off"
            spellCheck={false}
            className="py-2.5"
            {...register(`${name}.address`)}
          />
        )}
      </Field>
      <div id={decodedId} aria-live="polite" className="min-h-5">
        {parsed?.ok ? (
          <SubjectSummary subject={parsed.subject} />
        ) : parsed && !addressError ? (
          <span className="text-xs text-ink-soft">{parsed.error}</span>
        ) : null}
      </div>
      {showMemo && (
        <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-2.5">
          <Field label="Memo type">
            {({ id }) => (
              <Select id={id} className="py-2.5" {...register(`${name}.memo.type`)}>
                <option value="id">ID</option>
                <option value="text">Text</option>
                <option value="hash">Hash</option>
              </Select>
            )}
          </Field>
          <Field label="Memo (optional)" error={memoError} hint="For a shared exchange account.">
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                mono
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                autoComplete="off"
                className="py-2.5"
                {...register(`${name}.memo.value`)}
              />
            )}
          </Field>
        </div>
      )}
    </div>
  );
}
