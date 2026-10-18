"use client";

import type { ComponentProps, ReactNode } from "react";
import { get, type Path, type RegisterOptions, useFormContext, useFormState } from "react-hook-form";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { COUNTRIES } from "./countries";
import type { TravelRuleFormValues } from "./form";

export type FormPath = Path<TravelRuleFormValues>;

export function useFieldError(name: FormPath): string | undefined {
  const { errors } = useFormState<TravelRuleFormValues>({ name });
  return get(errors, name)?.message as string | undefined;
}

/** Label + registered input + inline error. */
export function TextField({
  name,
  label,
  hint,
  mono,
  className,
  inputClassName,
  rules,
  ...input
}: {
  name: FormPath;
  label: ReactNode;
  hint?: ReactNode;
  mono?: boolean;
  className?: string;
  inputClassName?: string;
  rules?: RegisterOptions<TravelRuleFormValues, FormPath>;
} & Omit<
  ComponentProps<"input">,
  "name"
>) {
  const { register } = useFormContext<TravelRuleFormValues>();
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          mono={mono}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn("py-2.5", inputClassName)}
          {...input}
          {...register(name, rules)}
        />
      )}
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  className,
  children,
}: {
  name: FormPath;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { register } = useFormContext<TravelRuleFormValues>();
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="py-2.5" {...register(name)}>
          {children}
        </Select>
      )}
    </Field>
  );
}

export function CountryOptions() {
  return (
    <>
      <option value="">Not given</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name} ({c.code})
        </option>
      ))}
    </>
  );
}
