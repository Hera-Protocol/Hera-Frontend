"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@hera/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { safeNext } from "@/components/auth/safe-next";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError } from "@/lib/api";
import { applyApiError } from "@/lib/hooks/forms";
import { useLogin } from "@/lib/queries";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const [credentialsWrong, setCredentialsWrong] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const ssoTipId = useId();

  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { register, handleSubmit, formState, setFocus } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setCredentialsWrong(false);
    try {
      await login.mutateAsync(values);
      router.replace(safeNext(params.get("next")));
    } catch (error) {
      if (error instanceof ApiError && (error.code === "invalid_credentials" || error.status === 401)) {
        setCredentialsWrong(true);
        setFocus("password", { shouldSelect: true });
        return;
      }
      const message = applyApiError(form, error);
      if (message) {
        setFormError(message);
        queueMicrotask(() => alertRef.current?.focus());
      }
    }
  });

  return (
    <div className="mx-auto my-auto flex w-full max-w-[440px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[40px] leading-none font-extrabold sm:text-[46px]">Welcome back</h1>
        <p className="text-[17px] text-ink-soft">Argus kept watch while you were away.</p>
      </div>

      {(credentialsWrong || formError) && (
        <div ref={alertRef} tabIndex={-1} role="alert" className="flex items-start gap-2.5 rounded-[12px] border-2 border-line bg-risk-severe-soft px-3 py-2.5 text-sm">
          {credentialsWrong ? (
            <p>
              <strong className="text-risk-severe">That email and password don&apos;t match.</strong> Check for typos, or{" "}
              <Link href="/forgot-password" className="font-semibold text-iris underline-offset-2 hover:underline">
                reset your password
              </Link>
              .
            </p>
          ) : (
            <strong className="text-risk-severe">{formError}</strong>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Work email" error={formState.errors.email?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-describedby={describedBy}
              aria-invalid={invalid || credentialsWrong || undefined}
              {...register("email")}
            />
          )}
        </Field>

        <div className="relative">
          <Field label="Password" error={formState.errors.password?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                aria-describedby={describedBy}
                aria-invalid={invalid || credentialsWrong || undefined}
                {...register("password")}
              />
            )}
          </Field>
          <Link href="/forgot-password" className="absolute top-0 right-0 text-sm font-semibold text-iris underline-offset-2 hover:underline">
            Forgot it?
          </Link>
        </div>

        <Button type="submit" variant="ink" size="lg" loading={login.isPending} className="mt-1 w-full">
          Log in
        </Button>

        <div className="flex items-center gap-3 text-[13px] text-ink-soft" aria-hidden>
          <span className="h-0.5 flex-1 bg-ink/15" />
          or
          <span className="h-0.5 flex-1 bg-ink/15" />
        </div>

        <div className="group relative">
          {/* aria-disabled rather than disabled, so keyboard users can still reach the tooltip. */}
          <button
            type="button"
            aria-disabled="true"
            aria-describedby={ssoTipId}
            onClick={(e) => e.preventDefault()}
            className="inline-flex min-h-13 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[12px] border-2 border-line bg-card px-6 text-[15px] font-bold text-ink opacity-70 shadow-hard"
          >
            Continue with SSO
            <span className="rounded-md border-2 border-line bg-sun px-1.5 font-mono text-[11px] text-[#17130F]">ENTERPRISE</span>
          </button>
          <span
            id={ssoTipId}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[280px] -translate-x-1/2 rounded-[10px] border-2 border-line bg-ink px-3 py-1.5 text-center text-[13px] font-semibold text-paper opacity-0 shadow-hard-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            SAML single sign-on is coming soon for Enterprise.
          </span>
        </div>
      </form>

      <p className="text-center text-[15px]">
        New to Hera?{" "}
        <Link href="/signup" className="font-bold text-iris underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
