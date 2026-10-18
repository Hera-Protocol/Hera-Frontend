"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema } from "@hera/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AuthCard, StepLabel } from "@/components/auth/auth-layout";
import { PasswordChecklist } from "@/components/auth/password-strength";
import { ButtonLink, Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { Stamp } from "@/components/ui/stamp";
import { ApiError } from "@/lib/api";
import { applyApiError } from "@/lib/hooks/forms";
import { keys, useResetPassword } from "@/lib/queries";

const formSchema = resetPasswordSchema
  .extend({ confirm: z.string().min(1, "Type the password again") })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match", path: ["confirm"] });

export function ResetPasswordFlow() {
  const token = useSearchParams().get("token") ?? "";
  const tokenLooksValid = resetPasswordSchema.shape.token.safeParse(token).success;
  const [expired, setExpired] = useState(!tokenLooksValid);

  if (expired) return <ExpiredLink />;
  return <ResetForm token={token} onExpired={() => setExpired(true)} />;
}

function ResetForm({ token, onExpired }: { token: string; onExpired: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const reset = useResetPassword();
  const [formError, setFormError] = useState<string | null>(null);
  const checklistId = useId();

  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: { token, password: "", confirm: "" } });
  const { register, handleSubmit, formState, control } = form;
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await reset.mutateAsync({ token, password });
      // The API signs this browser out too.
      qc.setQueryData(keys.me, null);
      toast.success("Password saved. Log in with your new one.");
      router.replace("/login");
    } catch (error) {
      if (error instanceof ApiError && (error.fields.token || error.status === 404 || error.status === 410)) {
        onExpired();
        return;
      }
      setFormError(applyApiError(form, error));
    }
  });

  return (
    <>
      <StepLabel>From the email link</StepLabel>
      <AuthCard>
        <h1 className="text-[32px] leading-none font-extrabold sm:text-4xl">Choose a new password</h1>
        <p className="text-[15px] text-ink-soft">Saving signs you out everywhere else.</p>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={formError} />
          <Field label="New password" error={formState.errors.password?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                aria-describedby={[describedBy, checklistId].filter(Boolean).join(" ")}
                aria-invalid={invalid || undefined}
                {...register("password")}
              />
            )}
          </Field>
          <PasswordChecklist value={password} id={checklistId} />
          <Field label="Confirm password" error={formState.errors.confirm?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                {...register("confirm")}
              />
            )}
          </Field>
          <Button type="submit" variant="ink" size="lg" loading={reset.isPending} className="w-full text-base">
            Save new password
          </Button>
        </form>
      </AuthCard>
    </>
  );
}

function ExpiredLink() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <>
      <StepLabel>If the link has expired</StepLabel>
      <AuthCard tone="expired" role="alert" className="items-start gap-3.5">
        <Stamp tone="medium" rotate={-6} className="bg-card">
          EXPIRED
        </Stamp>
        <h1 ref={headingRef} tabIndex={-1} className="text-[30px] leading-[1.05] font-extrabold outline-none">
          This link has expired
        </h1>
        <p className="text-base leading-relaxed">
          Reset links work for one hour and only once. Ask for a fresh one and you&apos;ll be back in a minute.
        </p>
        <ButtonLink href="/forgot-password">Send a new link</ButtonLink>
      </AuthCard>
    </>
  );
}
