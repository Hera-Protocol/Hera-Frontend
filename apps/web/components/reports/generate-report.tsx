"use client";

import { createReportSchema, type CreateReportInput, type ReportDto, type ReportType, shortAddress } from "@hera/core";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { forwardRef, useEffect, useState } from "react";
import { type FieldErrors, get, type Resolver, set, useForm, type UseFormRegisterReturn, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { personName } from "@/components/travel-rule/status";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatAmount, timeAgo } from "@/lib/format";
import { rememberReportParams, startDownload } from "@/lib/hooks/compliance";
import { reportPdfUrl, useCreateReport, useScreenings, useTravelRuleTransfers } from "@/lib/queries";
import { isoDate, type PeriodPreset, PRESETS, presetLabel, presetRange } from "./periods";

export interface GenerateValues {
  type: ReportType;
  preset: PeriodPreset;
  from: string;
  to: string;
  screeningId: string;
  transferId: string;
}

export function generateDefaults(over: Partial<GenerateValues> = {}): GenerateValues {
  const range = presetRange("this_quarter")!;
  return { type: "audit", preset: "this_quarter", ...range, screeningId: "", transferId: "", ...over };
}

function toInput(v: GenerateValues) {
  if (v.type === "audit") return { type: v.type, from: v.from, to: v.to };
  if (v.type === "screening_evidence") return { type: v.type, screeningId: v.screeningId };
  return { type: v.type, transferId: v.transferId };
}

const zod = zodResolver(createReportSchema);

const resolver: Resolver<GenerateValues, unknown, CreateReportInput> = async (values, ctx, options) => {
  const result = await zod(toInput(values) as never, ctx, options as never);
  const errors = { ...(result.errors as FieldErrors<GenerateValues>) };
  const friendly = (path: keyof GenerateValues, message: string) => get(errors, path) && set(errors, path, { type: "validate", message });
  friendly("screeningId", "Pick a screening.");
  friendly("transferId", "Pick a transfer.");
  if (get(errors, "from")?.type !== "custom") friendly("from", "Pick a start date.");
  if (get(errors, "to")?.message !== "Start must be before end") friendly("to", "Pick an end date.");
  return Object.keys(errors).length ? { values: {}, errors } : result;
};

const TYPES: { value: ReportType; title: string; body: string }[] = [
  { value: "audit", title: "Compliance audit", body: "Whole org, for a date range. For auditors and regulators." },
  { value: "screening_evidence", title: "Screening evidence", body: "One subject, every reason and source." },
  { value: "travel_rule", title: "Travel Rule record", body: "One transfer, IVMS101 and timeline." },
];

/**
 * Generate card. `prefill` (with a changing `nonce`) resets the form, e.g. to
 * retry a failed report or to arrive from a screening's "Export evidence".
 */
export const GenerateReport = forwardRef<HTMLElement, { prefill?: { values: Partial<GenerateValues>; nonce: number } | null; onCreated?: (r: ReportDto) => void }>(
  function GenerateReport({ prefill, onCreated }, ref) {
    const form = useForm<GenerateValues, unknown, CreateReportInput>({ resolver, defaultValues: generateDefaults(prefill?.values) });
    const { register, control, setValue, reset, handleSubmit, formState } = form;
    const [type, preset] = useWatch({ control, name: ["type", "preset"] });
    const create = useCreateReport();
    const [requestError, setRequestError] = useState<string | null>(null);
    const today = isoDate(new Date());

    useEffect(() => {
      if (prefill) reset(generateDefaults(prefill.values));
    }, [prefill, reset]);

    const choosePreset = (p: PeriodPreset) => {
      setValue("preset", p);
      const range = presetRange(p);
      if (range) {
        setValue("from", range.from, { shouldValidate: formState.isSubmitted });
        setValue("to", range.to, { shouldValidate: formState.isSubmitted });
      }
    };

    const onValid = async (input: CreateReportInput) => {
      setRequestError(null);
      try {
        const report = await create.mutateAsync(input);
        rememberReportParams(report.id, input);
        onCreated?.(report);
        if (report.status === "ready") {
          toast.success(`${report.reference} is ready`, { action: { label: "Download", onClick: () => startDownload(reportPdfUrl(report.id)) } });
        } else {
          toast.success("Audit report queued", { description: "It usually takes about a minute. We'll email you when it's ready." });
        }
      } catch (error) {
        setRequestError(errorMessage(error));
      }
    };

    const err = (name: keyof GenerateValues) => get(formState.errors, name)?.message as string | undefined;

    return (
      <section
        ref={ref}
        tabIndex={-1}
        aria-labelledby="generate-title"
        className="flex flex-col gap-4 rounded-[18px] border-3 border-line bg-card p-[22px] shadow-[6px_6px_0_var(--iris)] outline-none"
      >
        <h2 id="generate-title" className="text-2xl font-extrabold">
          Generate a report
        </h2>
        <form noValidate onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
          <fieldset>
            <legend className="sr-only">Report type</legend>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">
              {TYPES.map((t) => {
                const on = type === t.value;
                return (
                  <label
                    key={t.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-[14px] border-2 border-line p-3.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-iris",
                      on ? "bg-sun text-[#17130F] shadow-hard-sm" : "bg-card hover:bg-paper",
                    )}
                  >
                    <input type="radio" value={t.value} {...register("type")} className="mt-1 size-[18px] shrink-0 accent-[#17130F]" />
                    <span>
                      <strong className="block text-base">{t.title}</strong>
                      <span className={cn("text-[13px]", !on && "text-ink-soft")}>{t.body}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-end gap-3">
            {type === "audit" && (
              <>
                <Field label="Period" className="min-w-0 flex-[1_1_220px]">
                  {({ id }) => (
                    <Select id={id} value={preset} onChange={(e) => choosePreset(e.target.value as PeriodPreset)} className="bg-paper py-2.5">
                      {PRESETS.map((p) => (
                        <option key={p} value={p}>
                          {presetLabel(p)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {(["from", "to"] as const).map((name) => (
                  <Field key={name} label={name === "from" ? "From" : "To"} error={err(name)} className="min-w-0 flex-[1_1_150px]">
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        type="date"
                        max={today}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        className="py-2.5"
                        {...register(name, { onChange: () => setValue("preset", "custom") })}
                      />
                    )}
                  </Field>
                ))}
              </>
            )}
            {type === "screening_evidence" && <ScreeningPicker register={register("screeningId")} error={err("screeningId")} />}
            {type === "travel_rule" && <TransferPicker register={register("transferId")} error={err("transferId")} />}
            <Button type="submit" variant="ink" loading={create.isPending}>
              Generate PDF
            </Button>
          </div>
          <p className="text-[13px] text-ink-soft">
            {type === "audit"
              ? "Audit reports take about a minute. We'll email you when it's ready."
              : "Evidence and Travel Rule records are ready in a couple of seconds."}
          </p>
          <FormError message={requestError} />
        </form>
      </section>
    );
  },
);

type Registered = UseFormRegisterReturn;

function ScreeningPicker({ register, error }: { register: Registered; error?: string }) {
  const screenings = useScreenings(50);
  const items = screenings.data?.items ?? [];
  return (
    <Field
      label="Screening"
      error={error ?? (screenings.isError ? "Couldn't load screenings." : undefined)}
      hint={screenings.isSuccess && items.length === 0 ? <EmptyHint href="/app/screen" text="No screenings yet. Screen an address first." /> : undefined}
      className="min-w-0 flex-[1_1_320px]"
    >
      {({ id, describedBy, invalid }) => (
        <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} disabled={screenings.isPending} className="py-2.5" {...register}>
          <option value="">{screenings.isPending ? "Loading screenings…" : "Pick a recent screening"}</option>
          {items.map((s) => (
            <option key={s.id} value={s.id}>
              {shortAddress(s.display, 6, 6)} · {s.score} {s.band} · {timeAgo(s.createdAt)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function TransferPicker({ register, error }: { register: Registered; error?: string }) {
  const transfers = useTravelRuleTransfers();
  const items = transfers.data ?? [];
  return (
    <Field
      label="Transfer"
      error={error ?? (transfers.isError ? "Couldn't load transfers." : undefined)}
      hint={transfers.isSuccess && items.length === 0 ? <EmptyHint href="/app/travel-rule/new" text="No transfers yet. Create one first." /> : undefined}
      className="min-w-0 flex-[1_1_320px]"
    >
      {({ id, describedBy, invalid }) => (
        <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} disabled={transfers.isPending} className="py-2.5" {...register}>
          <option value="">{transfers.isPending ? "Loading transfers…" : "Pick a transfer"}</option>
          {items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.reference} · {personName(t.originator)} → {personName(t.beneficiary)} · {formatAmount(t.amount, 2)} {t.asset}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function EmptyHint({ href, text }: { href: string; text: string }) {
  return (
    <>
      {text}{" "}
      <Link href={href} className="font-semibold text-iris underline underline-offset-2">
        Go there
      </Link>
    </>
  );
}
