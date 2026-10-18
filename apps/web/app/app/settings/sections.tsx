"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type MeResponse, updateOrgSchema, updateProfileSchema } from "@hera/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Pill, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, Input } from "@/components/ui/field";
import { ErrorBlock, Skeleton, Switch } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { titleCase } from "@/lib/format";
import { useNotificationPrefs, useRole, useShowArgus, useUpdateNotifications } from "@/lib/hooks/account";
import { applyApiError } from "@/lib/hooks/forms";
import { useForgotPassword, useMyOrgs, useOrg, useSwitchOrg, useUpdateOrg, useUpdateProfile } from "@/lib/queries";

function Section({ id, title, children, className, titleClassName }: { id: string; title: string; children: ReactNode; className?: string; titleClassName?: string }) {
  return (
    <Card id={id} aria-labelledby={`${id}-title`} role="region" className={cn("flex scroll-mt-24 flex-col gap-3.5 p-5", className)}>
      <h2 id={`${id}-title`} className={cn("text-[22px] font-extrabold", titleClassName)}>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Row({ title, body, action, last }: { title: ReactNode; body: ReactNode; action?: ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 py-3", !last && "border-b border-dashed border-line/30")}>
      <div className="min-w-0 flex-[1_1_260px]">
        <strong className="flex flex-wrap items-center gap-2">{title}</strong>
        <div className="text-sm text-ink-soft">{body}</div>
      </div>
      {action}
    </div>
  );
}

/* ─── Profile ────────────────────────────────────────── */

export function ProfileSection({ me }: { me: MeResponse }) {
  const update = useUpdateProfile();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(updateProfileSchema), defaultValues: { name: me.user.name } });
  const { register, handleSubmit, formState, reset } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const next = await update.mutateAsync(values);
      reset({ name: next?.user.name ?? values.name });
      toast.success("Profile saved");
    } catch (error) {
      setFormError(applyApiError(form, error));
    }
  });

  return (
    <Section id="profile" title="Profile">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
        <FormError message={formError} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          <Field label="Name" error={formState.errors.name?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} autoComplete="name" aria-describedby={describedBy} aria-invalid={invalid || undefined} className="py-2.5 text-[15px]" {...register("name")} />
            )}
          </Field>
          <Field label="Email" hint={me.user.emailVerified ? undefined : "Use the link we emailed you, or resend it from the banner above."}>
            {({ id, describedBy }) => (
              <div className="relative">
                <Input id={id} value={me.user.email} readOnly aria-describedby={describedBy} className="bg-paper py-2.5 pr-28 text-[15px]" />
                <Pill tone={me.user.emailVerified ? "low" : "sun"} className="absolute top-1/2 right-2.5 -translate-y-1/2 px-2 py-0 text-xs">
                  {me.user.emailVerified ? "Verified" : "Unverified"}
                </Pill>
              </div>
            )}
          </Field>
        </div>
        <div>
          <Button type="submit" size="sm" className="min-h-10 px-4 text-sm" loading={update.isPending} disabled={!formState.isDirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ─── Security ───────────────────────────────────────── */

export function SecuritySection({ me }: { me: MeResponse }) {
  const forgot = useForgotPassword();
  return (
    <Section id="security" title="Security" className="gap-0">
      <div className="mt-2">
        <Row
          title="Password"
          body={
            <>
              We&apos;ll email a reset link to <span className="break-all">{me.user.email}</span>. It works for one hour.
            </>
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10"
              loading={forgot.isPending}
              onClick={async () => {
                try {
                  await forgot.mutateAsync({ email: me.user.email });
                  toast.success("Reset link sent", { description: `Check ${me.user.email}. The link works for one hour.` });
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              Change password
            </Button>
          }
        />
        <Row
          title={
            <>
              Two-factor authentication <Tag tone="iris">coming soon</Tag>
            </>
          }
          body="Authenticator app sign-in is on the way. We'll let owners know when it's ready."
          action={
            <Button variant="secondary" size="sm" className="min-h-10" disabled>
              Set up
            </Button>
          }
        />
        <Row
          last
          title="Active sessions"
          body="Sessions last 30 days and stay fresh while you use Hera. Resetting your password signs out every session."
        />
      </div>
    </Section>
  );
}

/* ─── Organization ───────────────────────────────────── */

export function OrganizationSection({ me }: { me: MeResponse }) {
  const org = useOrg();
  const { isAdmin } = useRole();

  return (
    <Section id="org" title="Organization">
      {org.isPending ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3" role="status" aria-label="Loading organization">
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
        </div>
      ) : org.isError ? (
        <ErrorBlock error={org.error} onRetry={() => org.refetch()} />
      ) : (
        <OrgForm key={org.data.name} name={org.data.name} plan={org.data.plan} canEdit={isAdmin} />
      )}
      <OrgList currentOrgId={me.org.id} />
    </Section>
  );
}

function OrgForm({ name, plan, canEdit }: { name: string; plan: MeResponse["org"]["plan"]; canEdit: boolean }) {
  const update = useUpdateOrg();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(updateOrgSchema), defaultValues: { name } });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await update.mutateAsync(values);
      toast.success("Organization renamed");
    } catch (error) {
      setFormError(applyApiError(form, error));
    }
  });

  const planField = (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">Plan</span>
      <div className="flex min-h-[48px] flex-wrap items-center justify-between gap-2 rounded-[11px] border-2 border-line bg-paper py-2 pr-2 pl-3">
        {titleCase(plan)}
        {plan === "developer" && (
          <Link href="/pricing" className="rounded-lg border-2 border-line bg-sun px-2 py-0.5 text-[13px] font-bold text-[#17130F]">
            Talk to us about Enterprise
          </Link>
        )}
      </div>
    </div>
  );

  if (!canEdit) {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        <Field label="Organization name" hint="Only owners and admins can rename it.">
          {({ id, describedBy }) => <Input id={id} value={name} readOnly aria-describedby={describedBy} className="bg-paper py-2.5 text-[15px]" />}
        </Field>
        {planField}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormError message={formError} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        <Field label="Organization name" error={formState.errors.name?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} autoComplete="organization" aria-describedby={describedBy} aria-invalid={invalid || undefined} className="py-2.5 text-[15px]" {...register("name")} />
          )}
        </Field>
        {planField}
      </div>
      {formState.isDirty && (
        <div>
          <Button type="submit" size="sm" className="min-h-10 px-4 text-sm" loading={update.isPending}>
            Save name
          </Button>
        </div>
      )}
    </form>
  );
}

function OrgList({ currentOrgId }: { currentOrgId: string }) {
  const orgs = useMyOrgs();
  const switchOrg = useSwitchOrg();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2 pt-1 text-sm">
      <strong id="your-orgs">Your organizations</strong>
      {orgs.isPending ? (
        <div className="flex gap-2" role="status" aria-label="Loading organizations">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-8 w-36 rounded-full" />
        </div>
      ) : orgs.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-risk-severe">
          Couldn&apos;t load your organizations.
          <button type="button" onClick={() => orgs.refetch()} className="font-bold text-ink underline underline-offset-2">
            Try again
          </button>
        </div>
      ) : (
        <ul aria-labelledby="your-orgs" className="flex flex-wrap gap-2">
          {orgs.data.map((o) => {
            const current = o.orgId === currentOrgId;
            const label = `${o.orgName} · ${titleCase(o.role)}`;
            return (
              <li key={o.orgId}>
                {current ? (
                  <span aria-current="true" className="inline-flex min-h-9 items-center rounded-full border-2 border-line bg-ink px-3 font-bold text-paper">
                    {label}
                    <span className="sr-only"> (current)</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={switchOrg.isPending}
                    className="inline-flex min-h-9 items-center rounded-full border-2 border-line bg-card px-3 font-bold hover:bg-paper-2 disabled:opacity-60"
                    aria-label={`Switch to ${o.orgName}, where you're ${o.role === "admin" || o.role === "analyst" || o.role === "owner" ? "an" : "a"} ${o.role}`}
                    onClick={async () => {
                      try {
                        await switchOrg.mutateAsync(o.orgId);
                        toast.success(`Switched to ${o.orgName}`);
                        router.push("/app");
                      } catch (error) {
                        toast.error(errorMessage(error));
                      }
                    }}
                  >
                    {label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── Notifications ──────────────────────────────────── */

export function NotificationsSection({ me }: { me: MeResponse }) {
  const prefs = useNotificationPrefs();
  const update = useUpdateNotifications();
  const { isAdmin } = useRole();
  const checked = prefs.data?.alertEmails ?? true;

  return (
    <Section id="notifications" title="Notifications" className="gap-2.5">
      <Switch
        checked={checked}
        onChange={(alertEmails) => {
          update.mutate(
            { alertEmails },
            {
              onSuccess: () => toast.success(alertEmails ? "Alert emails on" : "Alert emails off"),
              onError: (error) => toast.error(errorMessage(error)),
            },
          );
        }}
        label="High and critical alerts"
        description={
          isAdmin
            ? `Email ${me.user.email} the moment one is raised.`
            : "Hera emails these to owners and admins. Your choice applies if your role changes."
        }
      />
      <div className="flex items-center justify-between gap-4 py-2">
        <span>
          <strong className="block text-[15px]">Report ready</strong>
          <span className="text-sm text-ink-soft">When an audit report you requested finishes rendering.</span>
        </span>
        <Tag>always on</Tag>
      </div>
    </Section>
  );
}

/* ─── Appearance ─────────────────────────────────────── */

const THEMES = [
  // Swatches preview each theme regardless of the current one, so they use the palette values directly.
  { value: "light", label: "Light", swatch: "bg-[#FFF5E8]" },
  { value: "dark", label: "Dark", swatch: "bg-[#15110D]" },
  { value: "system", label: "Match system", swatch: "bg-[linear-gradient(90deg,#FFF5E8_50%,#15110D_50%)]" },
] as const;

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showArgus, setShowArgus] = useShowArgus();
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "system") : undefined;

  return (
    <Section id="appearance" title="Appearance">
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          {THEMES.map((t) => {
            const on = current === t.value;
            return (
              <label
                key={t.value}
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-[14px] border-line p-2.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iris",
                  on ? "border-[3px] shadow-[4px_4px_0_var(--iris)]" : "border-2",
                )}
              >
                <span aria-hidden className={cn("h-16 rounded-lg border-2 border-line", t.swatch)} />
                <span className="flex items-center gap-2 font-bold">
                  <input
                    type="radio"
                    name="theme"
                    value={t.value}
                    checked={on}
                    onChange={() => setTheme(t.value)}
                    className="size-4 accent-ink focus-visible:outline-none"
                  />
                  {t.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Switch checked={showArgus} onChange={setShowArgus} label="Show Argus" description="Hide the mascot if you prefer a quieter dashboard. Saved in this browser." />
    </Section>
  );
}

/* ─── Danger zone ────────────────────────────────────── */

export function DangerSection({ me }: { me: MeResponse }) {
  return (
    <Section
      id="danger"
      title="Danger zone"
      className="!bg-risk-severe-soft shadow-[4px_4px_0_var(--risk-severe)]"
      titleClassName="text-risk-severe"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[520px] text-sm">
          Deleting the organization removes members, keys and webhooks. Screenings, reports and the audit log may be kept as long as your record-keeping obligations require. To delete {me.org.name}, email{" "}
          <a href="mailto:support@heralayer.com" className="font-bold underline underline-offset-2">
            support@heralayer.com
          </a>{" "}
          from an owner&apos;s account.
        </p>
        <button
          type="button"
          disabled
          className="min-h-10 rounded-[10px] border-2 border-line bg-risk-severe px-3.5 text-sm font-bold text-paper disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete organization…
        </button>
      </div>
    </Section>
  );
}
