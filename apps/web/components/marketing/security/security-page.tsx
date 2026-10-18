import { Database, Eye, FileText, Fingerprint, KeyRound, Link2, Lock, ShieldCheck, Webhook } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Reveal, Stagger, StaggerItem } from "../motion";

const ITEMS: { title: string; body: string; tone: string; icon: LucideIcon }[] = [
  { title: "Passwords", body: "Hashed with argon2id. We never see or store them in readable form.", tone: "bg-card", icon: Lock },
  {
    title: "Sessions",
    body: "Random tokens in HttpOnly, SameSite cookies. Only a hash is stored, and sessions slide out after 30 days.",
    tone: "bg-card",
    icon: Fingerprint,
  },
  {
    title: "API keys",
    body: "Shown once, stored as a keyed hash, scoped, revocable, and never accepted from a browser by the SDK.",
    tone: "bg-sun/25",
    icon: KeyRound,
  },
  {
    title: "Webhooks",
    body: "Every delivery is HMAC-signed with a timestamp so replays fail. Secrets are encrypted at rest.",
    tone: "bg-peacock-soft",
    icon: Webhook,
  },
  { title: "Tenant isolation", body: "Every row belongs to one organization and every query is scoped to it.", tone: "bg-card", icon: Database },
  {
    title: "Tamper-evident audit log",
    body: "Each entry stores the hash of the one before. Verify the whole chain in one click.",
    tone: "bg-iris-soft",
    icon: Link2,
  },
  {
    title: "Verifiable reports",
    body: "PDFs carry SHA-256 hashes. Anyone can check a copy is genuine without seeing its contents.",
    tone: "bg-blush-soft",
    icon: FileText,
  },
  {
    title: "Personal data",
    body: "IVMS101 data appears only where it's needed and never in org-wide reports. EU hosting for Enterprise.",
    tone: "bg-card",
    icon: Eye,
  },
  {
    title: "Our own intelligence",
    body: "No resold vendor data. Every label shows where it came from and how confident we are.",
    tone: "bg-card",
    icon: ShieldCheck,
  },
];

export function SecurityHero() {
  return (
    <section aria-labelledby="security-title" className="mx-auto max-w-[1000px] px-4 pt-16 pb-10 sm:px-6 sm:pt-[72px]">
      <Reveal className="flex flex-col gap-3.5">
        <span className="eyebrow text-[13px]">Security</span>
        <h1 id="security-title" className="text-[clamp(40px,6vw,72px)] leading-[0.98] font-extrabold">
          A compliance tool has to be trustworthy first.
        </h1>
        <p className="max-w-[760px] text-lg leading-relaxed text-ink-soft sm:text-[19px]">
          Here&apos;s exactly how Hera protects your data, your keys and the evidence you hand to regulators.
        </p>
      </Reveal>
    </section>
  );
}

export function SecurityGrid() {
  return (
    <section aria-label="How Hera protects you" className="mx-auto max-w-[1000px] px-4 pb-16 sm:px-6">
      <Stagger className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ title, body, tone, icon: Icon }) => (
          <StaggerItem key={title} as="article" lift className={cn("flex flex-col gap-2 rounded-[16px] border-2 border-line p-5 shadow-hard", tone)}>
            <span className="mb-1 grid size-10 place-items-center rounded-[10px] border-2 border-line bg-card" aria-hidden>
              <Icon className="size-5" />
            </span>
            <h2 className="text-[21px] font-bold">{title}</h2>
            <p className="text-[15px] leading-relaxed">
              {body}
              {title === "Verifiable reports" && (
                <>
                  {" "}
                  <Link href="/verify" className="font-semibold underline decoration-2 underline-offset-2 hover:text-iris">
                    Verify a report
                  </Link>
                </>
              )}
            </p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function DisclosureCta() {
  return (
    <section aria-labelledby="disclosure-title" className="mx-auto max-w-[1000px] px-4 pb-24 sm:px-6">
      <Reveal className="overflow-hidden rounded-[22px] border-2 border-line shadow-[8px_8px_0_var(--peacock)]">
        <div data-theme="dark" className="flex flex-wrap items-center justify-between gap-5 bg-paper p-7 text-ink sm:p-8">
          <div className="max-w-[600px]">
            <h2 id="disclosure-title" className="text-[clamp(26px,3.6vw,32px)] font-extrabold">
              Found a vulnerability?
            </h2>
            <p className="mt-2 text-base text-ink-soft">
              Email security@heralayer.com. We reply within one business day and credit researchers who report responsibly.
            </p>
          </div>
          <a href="mailto:security@heralayer.com" className={buttonStyles({ variant: "primary", size: "lg" })}>
            Report an issue
          </a>
        </div>
      </Reveal>
    </section>
  );
}
