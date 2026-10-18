"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema } from "@hera/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { StrengthMeter } from "@/components/auth/password-strength";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { applyApiError } from "@/lib/hooks/forms";
import { useSignup } from "@/lib/queries";

const PLAN_OPTIONS = [
  { value: "developer", label: "Developer", body: "SDK, monitoring, screening" },
  { value: "enterprise", label: "Enterprise", body: "KYT, AML, Travel Rule" },
] as const;

export function SignupForm() {
  const router = useRouter();
  const signup = useSignup();
  const [formError, setFormError] = useState<string | null>(null);
  const meterId = useId();
  const planErrorId = useId();

  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", company: "", email: "", password: "", plan: "developer" as const },
  });
  const { register, handleSubmit, formState, control } = form;
  const password = useWatch({ control, name: "password" }) ?? "";
  const plan = useWatch({ control, name: "plan" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signup.mutateAsync(values);
      router.replace("/verify-email?sent=1");
    } catch (error) {
      setFormError(applyApiError(form, error, { email_taken: "email" }));
    }
  });

  const errors = formState.errors;

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[38px] leading-none font-extrabold sm:text-[44px]">Create your account</h1>
        <p className="text-[17px] text-ink-soft">Screen your first wallet in about five minutes.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
          <Field label="Your name" error={errors.name?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} autoComplete="name" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...register("name")} />
            )}
          </Field>
          <Field label="Company" error={errors.company?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} autoComplete="organization" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...register("company")} />
            )}
          </Field>
        </div>

        <Field label="Work email" error={errors.email?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              {...register("email")}
            />
          )}
        </Field>

        <Field label="Password" error={errors.password?.message} hint="At least 10 characters, with letters and numbers.">
          {({ id, describedBy, invalid }) => (
            <>
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                aria-describedby={[describedBy, meterId].filter(Boolean).join(" ")}
                aria-invalid={invalid || undefined}
                {...register("password")}
              />
              <StrengthMeter value={password} id={meterId} />
            </>
          )}
        </Field>

        <fieldset className="flex flex-col gap-2" aria-describedby={errors.plan ? planErrorId : undefined}>
          <legend className="mb-2 text-sm font-semibold">Plan</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            {PLAN_OPTIONS.map((option) => {
              const selected = plan === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-[14px] border-2 border-line p-3.5 transition-shadow has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iris",
                    selected ? "bg-sun text-[#17130F] shadow-hard" : "bg-card",
                  )}
                >
                  <input type="radio" value={option.value} className="mt-0.5 size-[18px] accent-[#17130F] focus-visible:outline-none" {...register("plan")} />
                  <span className="flex flex-col gap-0.5">
                    <strong className="text-base">{option.label}</strong>
                    <span className={cn("text-[13px]", !selected && "text-ink-soft")}>{option.body}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {errors.plan && (
            <span id={planErrorId} className="text-[13px] font-medium text-risk-severe">
              {errors.plan.message}
            </span>
          )}
        </fieldset>

        <Button type="submit" variant="ink" size="lg" loading={signup.isPending} className="mt-1.5 w-full">
          Create account
        </Button>
        <p className="text-center text-[13px] text-ink-soft">By continuing you agree to the Terms and Privacy Policy.</p>
      </form>

      <p className="text-center text-[15px]">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-iris underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
