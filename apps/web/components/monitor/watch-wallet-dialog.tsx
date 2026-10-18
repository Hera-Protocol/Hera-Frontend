"use client";

import { type CreateWalletInput, createWalletSchema, type ScreenRequest } from "@hera/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ChainOptions, SubjectHint } from "@/components/screening/subject-fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { ApiError, errorMessage } from "@/lib/api";
import { type ChainChoice, checkSubject, fullAddressLength, type MemoType } from "@/lib/hooks/monitor";
import { useCreateWallet } from "@/lib/queries";

type FormValues = {
  address: string;
  memo: { type: MemoType; value: string };
  label: string;
  customerRef: string;
};

/**
 * "Watch a wallet". With `subject`, the address is fixed (from a screening)
 * and only the label and customer reference are asked for.
 */
export function WatchWalletDialog({
  open,
  onClose,
  subject,
  subjectDisplay,
}: {
  open: boolean;
  onClose: () => void;
  subject?: ScreenRequest;
  subjectDisplay?: string;
}) {
  const router = useRouter();
  const create = useCreateWallet();
  const [chain, setChain] = useState<ChainChoice>(subject?.chain ?? "detect");
  const [requestError, setRequestError] = useState<string | null>(null);
  const locked = Boolean(subject);

  const form = useForm<FormValues>({
    // Validate the fields with the core schema; chain lives outside the form ("detect" isn't a ChainId).
    resolver: async (values, context, options) => {
      const body = toInput(values, chain);
      const resolve = zodResolver(createWalletSchema);
      const result = await resolve(body as never, context, options as never);
      return Object.keys(result.errors).length ? { values: {}, errors: result.errors as never } : { values, errors: {} };
    },
    defaultValues: blank(subject),
  });
  const { register, handleSubmit, watch, setError, reset, formState } = form;

  useEffect(() => {
    if (open) {
      reset(blank(subject));
      setChain(subject?.chain ?? "detect");
      setRequestError(null);
      create.reset();
    }
  }, [open]);

  const address = watch("address");
  const memoType = watch("memo.type");
  const memoValue = watch("memo.value");
  const check = checkSubject({ address, chain, memoType, memo: memoValue });

  const submit = handleSubmit(async (values) => {
    setRequestError(null);
    if (!locked) {
      if (check.state === "error") {
        setError(check.field === "memo" ? "memo.value" : "address", { message: check.message });
        return;
      }
    }
    try {
      const wallet = await create.mutateAsync(toInput(values, chain));
      toast.success(`Watching ${wallet.label}`, {
        description: wallet.lastBand ? `First screen: ${wallet.lastScore} · ${wallet.lastBand}` : undefined,
        action: { label: "View", onClick: () => router.push(`/app/wallets/${wallet.id}`) },
      });
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setRequestError("You're already watching that wallet.");
        return;
      }
      if (e instanceof ApiError && Object.keys(e.fields).length) {
        for (const [field, message] of Object.entries(e.fields)) {
          const name = field === "memo" || field.startsWith("memo") ? "memo.value" : (field as keyof FormValues);
          if (["address", "label", "customerRef", "memo.value"].includes(name)) setError(name as "address", { message });
          else setRequestError(message);
        }
        return;
      }
      setRequestError(errorMessage(e));
    }
  });

  const errors = formState.errors;
  const isStellar = /^[GM]/.test(address.trim()) || chain === "stellar";

  return (
    <Dialog open={open} onClose={onClose} title="Watch a wallet">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        {locked ? (
          <div className="rounded-[12px] border-2 border-line bg-paper px-3.5 py-3">
            <span className="eyebrow">Subject</span>
            <p className="font-mono text-sm break-all">{subjectDisplay ?? subject?.address}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-[170px_1fr]">
              <Field label="Chain">
                {({ id }) => (
                  <Select id={id} value={chain} onChange={(e) => setChain(e.target.value as ChainChoice)}>
                    <ChainOptions />
                  </Select>
                )}
              </Field>
              <Field label="Address" error={errors.address?.message}>
                {({ id, describedBy, invalid }) => (
                  <>
                    <Input
                      id={id}
                      mono
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="G…, M… or 0x…"
                      aria-invalid={invalid || check.state === "error" || undefined}
                      aria-describedby={[describedBy, `${id}-check`].filter(Boolean).join(" ")}
                      {...register("address")}
                    />
                    {!errors.address && (check.state === "ok" || (check.state === "error" && (check.field !== "address" || formState.isSubmitted || address.trim().length >= fullAddressLength(address)))) && (
                      <SubjectHint id={`${id}-check`} check={check} />
                    )}
                  </>
                )}
              </Field>
            </div>
            {isStellar && !address.trim().startsWith("M") && (
              <div className="grid grid-cols-[120px_1fr] gap-2.5 sm:grid-cols-[140px_1fr]">
                <Field label="Memo type">
                  {({ id }) => (
                    <Select id={id} {...register("memo.type")}>
                      <option value="id">ID</option>
                      <option value="text">Text</option>
                      <option value="hash">Hash</option>
                    </Select>
                  )}
                </Field>
                <Field label="Memo value" hint="Optional" error={errors.memo?.value?.message}>
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} mono autoComplete="off" aria-invalid={invalid || undefined} aria-describedby={describedBy} {...register("memo.value")} />
                  )}
                </Field>
              </div>
            )}
          </>
        )}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Field label="Label" error={errors.label?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} placeholder="Treasury hot wallet" aria-invalid={invalid || undefined} aria-describedby={describedBy} {...register("label")} />
            )}
          </Field>
          <Field label="Customer reference (optional)" error={errors.customerRef?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} mono placeholder="cus_88213" aria-invalid={invalid || undefined} aria-describedby={describedBy} {...register("customerRef")} />
            )}
          </Field>
        </div>
        <FormError message={requestError} />
        <div className="mt-1.5 flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            {create.isPending ? "Screening…" : "Watch and screen now"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function blank(subject?: ScreenRequest): FormValues {
  return {
    address: subject?.address ?? "",
    memo: { type: subject?.memo?.type ?? "id", value: subject?.memo?.value ?? "" },
    label: "",
    customerRef: "",
  };
}

function toInput(values: FormValues, chain: ChainChoice): CreateWalletInput {
  const memo = values.memo.value.trim();
  const ref = values.customerRef.trim();
  return {
    address: values.address.trim(),
    label: values.label.trim(),
    ...(chain !== "detect" ? { chain } : {}),
    ...(memo && !/^0x/i.test(values.address.trim()) ? { memo: { type: values.memo.type, value: memo } } : {}),
    ...(ref ? { customerRef: ref } : {}),
  };
}
