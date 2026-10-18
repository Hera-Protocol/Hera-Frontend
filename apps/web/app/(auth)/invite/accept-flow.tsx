"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { acceptInviteSchema, type InviteLookupResponse, passwordSchema, type Role } from "@hera/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { initialsOf } from "@/components/admin/avatar";
import { AuthCard, StepLabel } from "@/components/auth/auth-layout";
import { StrengthMeter } from "@/components/auth/password-strength";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { ErrorBlock, Skeleton } from "@/components/ui/misc";
import { ApiError } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { applyApiError } from "@/lib/hooks/forms";
import { useAcceptInvite, useInviteLookup } from "@/lib/queries";

const newUserSchema = acceptInviteSchema.extend({
  name: z.string().trim().min(2, "Tell us your name").max(80),
  password: passwordSchema,
});
const existingUserSchema = acceptInviteSchema.extend({ password: z.string().min(1, "Enter your password").max(128) });

const article = (role: Role) => (role === "admin" || role === "analyst" || role === "owner" ? "an" : "a");

export function AcceptInviteFlow() {
  const token = useSearchParams().get("token");
  const lookup = useInviteLookup(token);
  const [expired, setExpired] = useState(false);

  if (!token) return <InviteProblem kind="invalid" />;

  if (lookup.isPending) {
    return (
      <div className="brutal flex flex-col gap-4 p-7" role="status" aria-label="Loading your invite">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (lookup.isError) {
    if (lookup.error instanceof ApiError && lookup.error.status === 404) return <InviteProblem kind="invalid" />;
    if (lookup.error instanceof ApiError && lookup.error.status === 410) return <InviteProblem kind="expired" />;
    return (
      <div className="brutal">
        <ErrorBlock error={lookup.error} onRetry={() => lookup.refetch()} />
      </div>
    );
  }

  const invite = lookup.data;
  if (invite.expired || expired) return <InviteProblem kind="expired" invite={invite} />;

  return invite.existingUser ? (
    <ExistingUserForm token={token} invite={invite} onExpired={() => setExpired(true)} />
  ) : (
    <NewUserForm token={token} invite={invite} onExpired={() => setExpired(true)} />
  );
}

function useAcceptSuccess(orgName: string) {
  const router = useRouter();
  return () => {
    toast.success(`Welcome to ${orgName}`);
    router.replace("/app");
  };
}

function InviteBanner({ invite }: { invite: InviteLookupResponse }) {
  return (
    <div className="flex items-center gap-3.5 border-b-2 border-line bg-blush px-5 py-5 text-[#17130F] sm:px-7">
      <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-line bg-iris font-display font-extrabold text-paper" aria-hidden>
        {initialsOf(invite.invitedBy)}
      </span>
      <p className="text-base leading-snug">
        <strong className="break-all">{invite.invitedBy}</strong> invited you to join <strong>{invite.orgName}</strong> as {article(invite.role)}{" "}
        <strong>{titleCase(invite.role)}</strong>.
      </p>
    </div>
  );
}

function NewUserForm({ token, invite, onExpired }: { token: string; invite: InviteLookupResponse; onExpired: () => void }) {
  const accept = useAcceptInvite();
  const done = useAcceptSuccess(invite.orgName);
  const [formError, setFormError] = useState<string | null>(null);
  const meterId = useId();

  const form = useForm({ resolver: zodResolver(newUserSchema), defaultValues: { token, name: "", password: "" } });
  const { register, handleSubmit, formState, control } = form;
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await accept.mutateAsync(values);
      done();
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) return onExpired();
      setFormError(applyApiError(form, error));
    }
  });

  return (
    <>
      <StepLabel>New to Hera</StepLabel>
      <section className="overflow-hidden rounded-[20px] border-2 border-line bg-card shadow-[6px_6px_0_var(--shadow-color)]">
        <InviteBanner invite={invite} />
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5 p-5 sm:p-7">
          <h1 className="text-[30px] leading-none font-extrabold sm:text-[32px]">Set up your account</h1>
          <FormError message={formError} />
          <Field label="Email" hint="Invites are tied to this address.">
            {({ id, describedBy }) => <Input id={id} value={invite.email} readOnly aria-describedby={describedBy} className="bg-paper" />}
          </Field>
          <Field label="Your name" error={formState.errors.name?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} autoComplete="name" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...register("name")} />
            )}
          </Field>
          <Field label="Password" error={formState.errors.password?.message} hint="At least 10 characters, with letters and numbers.">
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
          <Button type="submit" size="lg" loading={accept.isPending} className="w-full text-base">
            Join {invite.orgName}
          </Button>
          <p className="text-[13px] text-ink-soft">Invite links last 7 days and work once.</p>
        </form>
      </section>
    </>
  );
}

function ExistingUserForm({ token, invite, onExpired }: { token: string; invite: InviteLookupResponse; onExpired: () => void }) {
  const accept = useAcceptInvite();
  const done = useAcceptSuccess(invite.orgName);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({ resolver: zodResolver(existingUserSchema), defaultValues: { token, password: "" } });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await accept.mutateAsync({ token: values.token, password: values.password });
      done();
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) return onExpired();
      if (error instanceof ApiError && error.status === 401) {
        form.setError("password", { type: "server", message: error.message }, { shouldFocus: true });
        return;
      }
      setFormError(applyApiError(form, error));
    }
  });

  return (
    <>
      <StepLabel>Already have an account</StepLabel>
      <section className="overflow-hidden rounded-[20px] border-2 border-line bg-card shadow-[6px_6px_0_var(--shadow-color)]">
        <InviteBanner invite={invite} />
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5 p-5 sm:p-7">
          <h1 className="text-[30px] leading-[1.05] font-extrabold">Join {invite.orgName}</h1>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            You already use Hera as <strong className="break-all text-ink">{invite.email}</strong>. Confirm your password and {invite.orgName} appears in your
            org switcher.
          </p>
          <FormError message={formError} />
          <Field label="Password" error={formState.errors.password?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                {...register("password")}
              />
            )}
          </Field>
          <Button type="submit" variant="ink" size="lg" loading={accept.isPending} className="w-full text-base">
            Accept as {titleCase(invite.role)}
          </Button>
          <Link href="/forgot-password" className="text-center text-sm font-semibold text-iris underline-offset-2 hover:underline">
            Forgot your password?
          </Link>
        </form>
      </section>
    </>
  );
}

function InviteProblem({ kind, invite }: { kind: "invalid" | "expired"; invite?: InviteLookupResponse }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <>
      <StepLabel>{kind === "expired" ? "Invite expired" : "Invite link"}</StepLabel>
      <AuthCard tone="error" role="alert" className="items-start gap-3.5">
        <h1 ref={headingRef} tabIndex={-1} className="text-[30px] leading-[1.05] font-extrabold outline-none">
          {kind === "expired" ? "This invite has expired" : "We couldn't find that invite"}
        </h1>
        <p className="text-base leading-relaxed">
          {kind === "expired" ? (
            <>
              <strong className="text-risk-severe">Invite expired or revoked?</strong> Ask{" "}
              {invite ? <strong className="break-all">{invite.invitedBy}</strong> : "whoever invited you"} to resend it from Team settings
              {invite ? <> in {invite.orgName}</> : null}.
            </>
          ) : (
            <>The link may be incomplete or already used. Open it again from the email, or ask whoever invited you to resend it from Team settings.</>
          )}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink href="/login" variant="secondary">
            Log in
          </ButtonLink>
          <ButtonLink href="/" variant="ghost">
            Hera home
          </ButtonLink>
        </div>
      </AuthCard>
    </>
  );
}
