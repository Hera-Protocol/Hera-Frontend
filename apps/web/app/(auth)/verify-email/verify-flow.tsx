"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AuthCard, IconTile, StepLabel } from "@/components/auth/auth-layout";
import { Button, ButtonLink, Spinner } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Stamp } from "@/components/ui/stamp";
import { errorMessage } from "@/lib/api";
import { useLogout, useMe, useResendVerification, useVerifyEmail } from "@/lib/queries";

export function VerifyEmailFlow() {
  const token = useSearchParams().get("token");
  return token ? <VerifyToken token={token} /> : <CheckInbox />;
}

/* ─── With ?token=: confirm it once ──────────────────── */

function VerifyToken({ token }: { token: string }) {
  const verify = useVerifyEmail();
  const { mutate } = verify;
  // Strict mode runs effects twice in development; refs survive the remount,
  // so the token is only ever spent once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate({ token });
  }, [mutate, token]);

  if (verify.isSuccess) return <Verified />;
  if (verify.isError) return <VerifyExpired />;
  return (
    <AuthCard role="status" aria-live="polite" className="items-start">
      <span className="flex items-center gap-2.5 font-semibold">
        <Spinner className="size-5" />
        Checking your link…
      </span>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-full" />
    </AuthCard>
  );
}

function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => ref.current?.focus(), []);
  return ref;
}

function Verified() {
  const { data: me } = useMe();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const firstName = me?.user.name.split(/\s+/)[0];
  return (
    <>
      <StepLabel>After clicking the link</StepLabel>
      <AuthCard tone="verified" role="status" className="items-start">
        <Stamp tone="low" className="bg-card text-[26px]">
          VERIFIED
        </Stamp>
        <h1 ref={headingRef} tabIndex={-1} className="text-[32px] leading-[1.05] font-extrabold outline-none">
          {firstName ? `You're all set, ${firstName}` : "You're all set"}
        </h1>
        <p className="text-base leading-relaxed">
          {me ? "API keys and webhooks are unlocked. Time to screen something." : "Your email is confirmed. Log in to start screening."}
        </p>
        {me ? (
          <ButtonLink href="/app/screen" variant="ink">
            Screen your first address
          </ButtonLink>
        ) : (
          <ButtonLink href="/login?next=%2Fapp%2Fscreen" variant="ink">
            Log in
          </ButtonLink>
        )}
      </AuthCard>
    </>
  );
}

function VerifyExpired() {
  const { data: me } = useMe();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
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
          Verification links work for 24 hours and only once. {me ? "We can send you a fresh one." : "Log in and we'll send you a fresh one."}
        </p>
        {me ? (
          <div className="flex flex-wrap gap-2.5">
            <ResendButton variant="primary" label="Send a new link" />
            <ButtonLink href="/app" variant="secondary">
              Continue to Hera
            </ButtonLink>
          </div>
        ) : (
          <ButtonLink href="/login?next=%2Fapp">Log in</ButtonLink>
        )}
      </AuthCard>
    </>
  );
}

/* ─── ?sent=1 or nothing: one quick check ────────────── */

function CheckInbox() {
  const me = useMe();
  const logout = useLogout();
  const router = useRouter();

  if (me.isPending) {
    return (
      <AuthCard aria-busy="true">
        <Skeleton className="size-16" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-full" />
      </AuthCard>
    );
  }

  const user = me.data?.user;
  if (user?.emailVerified) return <Verified />;

  return (
    <>
      <StepLabel>Right after sign-up</StepLabel>
      <AuthCard className="items-start">
        <IconTile tone="sun">
          <MailCheck className="size-7" />
        </IconTile>
        <h1 className="text-[32px] leading-none font-extrabold sm:text-4xl">One quick check</h1>
        <p className="text-base leading-relaxed">
          {user ? (
            <>
              We sent a link to <strong className="break-all">{user.email}</strong>.
            </>
          ) : (
            "We sent a link to your work email."
          )}{" "}
          Click it to confirm it&apos;s really you. You can keep exploring Hera in the meantime.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink href="/app">Continue to Hera</ButtonLink>
          {user ? (
            <ResendButton variant="secondary" label="Resend email" />
          ) : (
            <ButtonLink href="/login?next=%2Fapp" variant="secondary">
              Log in to resend
            </ButtonLink>
          )}
        </div>
        {user && (
          <p className="text-[13px] text-ink-soft">
            Wrong address?{" "}
            <button
              type="button"
              className="font-bold text-iris underline-offset-2 hover:underline"
              onClick={async () => {
                await logout.mutateAsync().catch(() => undefined);
                router.push("/signup");
              }}
            >
              Start over
            </button>
          </p>
        )}
        {!user && (
          <p className="text-[13px] text-ink-soft">
            Need an account?{" "}
            <Link href="/signup" className="font-bold text-iris underline-offset-2 hover:underline">
              Sign up
            </Link>
          </p>
        )}
      </AuthCard>
    </>
  );
}

function ResendButton({ variant, label }: { variant: "primary" | "secondary"; label: string }) {
  const resend = useResendVerification();
  const [sent, setSent] = useState(false);
  return (
    <Button
      variant={variant}
      loading={resend.isPending}
      disabled={sent}
      onClick={async () => {
        try {
          await resend.mutateAsync();
          setSent(true);
          toast.success("Sent. Check your inbox.");
        } catch (error) {
          toast.error(errorMessage(error));
        }
      }}
    >
      {sent ? "Sent" : label}
    </Button>
  );
}
