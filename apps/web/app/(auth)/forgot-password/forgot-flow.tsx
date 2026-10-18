"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema } from "@hera/core";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AuthCard, IconTile, StepLabel } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { errorMessage } from "@/lib/api";
import { applyApiError } from "@/lib/hooks/forms";
import { useForgotPassword } from "@/lib/queries";

export function ForgotPasswordFlow() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { register, handleSubmit, formState } = form;

  // Move focus to the confirmation so screen readers hear it.
  useEffect(() => {
    if (sentTo) headingRef.current?.focus();
  }, [sentTo]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      // The API answers 202 whether or not the account exists.
      await forgot.mutateAsync(values);
      setSentTo(values.email);
    } catch (error) {
      setFormError(applyApiError(form, error));
    }
  });

  const resend = async () => {
    if (!sentTo) return;
    try {
      await forgot.mutateAsync({ email: sentTo });
      toast.success("Sent another link.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (sentTo) {
    return (
      <>
        <StepLabel>Step 2 · Sent</StepLabel>
        <AuthCard tone="sent" role="status" className="items-start">
          <IconTile>
            <MailCheck className="size-7" />
          </IconTile>
          <h1 ref={headingRef} tabIndex={-1} className="text-[32px] leading-[1.05] font-extrabold outline-none">
            Check your inbox
          </h1>
          <p className="text-base leading-relaxed">
            If an account exists for <strong className="break-all">{sentTo}</strong>, a reset link is on its way. It expires in one hour.
          </p>
          <p className="text-sm">
            Nothing after 5 minutes? Check spam, or{" "}
            <button type="button" onClick={resend} disabled={forgot.isPending} className="font-bold underline underline-offset-2 disabled:opacity-60">
              {forgot.isPending ? "sending…" : "send it again"}
            </button>
            .
          </p>
          <p className="text-sm">
            <button type="button" onClick={() => setSentTo(null)} className="font-semibold underline underline-offset-2">
              Use a different email
            </button>
          </p>
        </AuthCard>
      </>
    );
  }

  return (
    <>
      <StepLabel>Step 1 · Ask for a link</StepLabel>
      <AuthCard>
        <h1 className="text-[32px] leading-none font-extrabold sm:text-4xl">Forgot your password?</h1>
        <p className="text-base leading-relaxed text-ink-soft">
          It happens. Enter your work email and we&apos;ll send a reset link that works for one hour.
        </p>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={formError} />
          <Field label="Work email" error={formState.errors.email?.message}>
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
          <Button type="submit" size="lg" loading={forgot.isPending} className="w-full text-base">
            Send reset link
          </Button>
        </form>
        <Link href="/login" className="text-center text-[15px] font-semibold text-iris underline-offset-2 hover:underline">
          ← Back to log in
        </Link>
      </AuthCard>
    </>
  );
}
