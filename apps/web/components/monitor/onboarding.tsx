"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Argus } from "@/components/brand/argus";
import { SCREEN_EXAMPLES } from "@/components/screening/examples";
import { SubjectHint } from "@/components/screening/subject-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { firstName, useSubjectCheck } from "@/lib/hooks/monitor";
import { useApiKeys, useMe, useOrg, useWebhooks } from "@/lib/queries";

type Step = { key: string; title: string; body: ReactNode; done: boolean; href?: string; cta?: string };

/** First-run checklist. Every step's state comes from real data. */
export function Onboarding({ screeningsTotal, watchedWallets }: { screeningsTotal: number; watchedWallets: number }) {
  const { data: me } = useMe();
  const keys = useApiKeys();
  const webhooks = useWebhooks();
  const org = useOrg();

  const steps: Step[] = [
    {
      key: "email",
      title: "Verify your email",
      body: me?.user.emailVerified ? "Done. Welcome aboard." : `Click the link we sent to ${me?.user.email ?? "your inbox"}.`,
      done: Boolean(me?.user.emailVerified),
    },
    { key: "screen", title: "Screen your first address", body: "Paste any Stellar or Ethereum address. Muxed M… addresses work too.", done: screeningsTotal > 0 },
    { key: "wallet", title: "Watch a wallet", body: "Get an alert the moment something risky touches it.", done: watchedWallets > 0, href: "/app/wallets", cta: "Add wallet" },
    {
      key: "key",
      title: "Create an API key and install the SDK",
      body: <span className="font-mono">npm install @hera/sdk</span>,
      done: (keys.data ?? []).some((k) => !k.revokedAt),
      href: "/app/keys",
      cta: "Create key",
    },
    { key: "webhook", title: "Add a webhook", body: "Push alerts and wallet activity to your backend.", done: (webhooks.data?.length ?? 0) > 0, href: "/app/webhooks", cta: "Add endpoint" },
    {
      key: "team",
      title: "Invite your team",
      body: "Analysts decide alerts, viewers just watch.",
      done: (org.data?.members.length ?? 0) > 1,
      href: "/app/team",
      cta: "Invite",
    },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <>
      <section className="flex flex-wrap items-center gap-6 rounded-[20px] border-2 border-line bg-peacock-soft p-6 shadow-hard-lg sm:p-7">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-2.5">
          <span className="eyebrow !text-ink">Welcome to Hera</span>
          <h1 className="text-[34px] leading-none font-extrabold sm:text-[42px]">
            Hi {firstName(me?.user.name) || "there"}. Let&apos;s get {me?.org.name ?? "your team"} compliant.
          </h1>
          <p className="text-base leading-relaxed">Six small steps. Argus will keep an eye on things while you go.</p>
          <div className="mt-1.5 flex items-center gap-3">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={done}
              aria-label="Setup progress"
              className="h-3.5 max-w-[320px] flex-1 overflow-hidden rounded-full border-2 border-line bg-card"
            >
              <motion.div
                className="h-full border-r-2 border-line bg-sun"
                initial={{ width: 0 }}
                animate={{ width: `${(done / steps.length) * 100}%` }}
                transition={{ duration: 0.7, ease: [0.2, 0, 0, 1] }}
              />
            </div>
            <span className="font-mono text-[13px]">
              {done} of {steps.length} done
            </span>
          </div>
        </div>
        <Argus mood="happy" size={150} className="mx-auto sm:mx-0" />
      </section>

      <div className="flex flex-wrap items-start gap-[22px]">
        <ol className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
          {steps.map((s, i) =>
            s.key === "screen" && !s.done ? (
              <ScreenStep key={s.key} index={i + 1} step={s} />
            ) : (
              <li
                key={s.key}
                className={cn("flex items-center gap-3.5 rounded-[14px] border-2 border-line px-4 py-3.5", s.done ? "bg-risk-low-soft" : "bg-card")}
              >
                <StepBadge index={i + 1} done={s.done} />
                <div className="min-w-0 flex-1">
                  <strong className="text-base">{s.title}</strong>
                  <div className="text-sm text-ink-soft">{s.body}</div>
                </div>
                {!s.done && s.href && (
                  <Link href={s.href} className="flex min-h-10 shrink-0 items-center text-sm font-bold text-iris hover:underline">
                    {s.cta} →
                  </Link>
                )}
              </li>
            ),
          )}
        </ol>
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-[18px]">
          <Card className="flex flex-col gap-2.5 p-[18px]">
            <h2 className="text-xl font-extrabold">Building on Stellar?</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              Shared exchange and anchor accounts hide many customers. Screen the M… address or add the memo to score the person, not the exchange.
            </p>
            <Link href={`/app/screen?address=${SCREEN_EXAMPLES[1].address}`} className="text-sm font-bold text-iris hover:underline">
              Screen a muxed customer →
            </Link>
          </Card>
          <section className="flex flex-col gap-2.5 rounded-[16px] border-2 border-line bg-ink p-[18px] text-paper shadow-[4px_4px_0_var(--peacock)]">
            <h2 className="text-xl font-extrabold">One line in your app</h2>
            <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap">await hera.guard({"{ address }"})</pre>
            <Link href="/developers" className="text-sm font-bold text-sun hover:underline">
              SDK quick start →
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}

function StepBadge({ index, done, active }: { index: number; done: boolean; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full font-extrabold",
        done ? "bg-risk-low text-card" : active ? "border-2 border-line bg-sun text-[#17130F]" : "border-2 border-dashed border-line",
      )}
    >
      {done ? <Check className="size-4" aria-hidden /> : index}
      <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
    </span>
  );
}

function ScreenStep({ index, step }: { index: number; step: Step }) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [touched, setTouched] = useState(false);
  const check = useSubjectCheck({ address, chain: "detect", memoType: "id", memo: "" });
  const go = (a: string) => router.push(`/app/screen?address=${encodeURIComponent(a.trim())}`);
  return (
    <li className="flex flex-col gap-3 rounded-[14px] border-[3px] border-line bg-card p-4 shadow-[6px_6px_0_var(--iris)]">
      <div className="flex items-center gap-3.5">
        <StepBadge index={index} done={false} active />
        <div className="min-w-0 flex-1">
          <strong className="text-base">{step.title}</strong>
          <div className="text-sm text-ink-soft">{step.body}</div>
        </div>
      </div>
      <form
        className="flex flex-wrap gap-2.5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (check.state === "ok") go(address);
        }}
      >
        <label htmlFor="onboard-address" className="sr-only">
          Address
        </label>
        <Input
          id="onboard-address"
          mono
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="G…, M… or 0x…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={touched && check.state === "error" ? true : undefined}
          aria-describedby="onboard-hint"
          className="min-w-0 flex-[1_1_280px] bg-paper"
        />
        <Button type="submit">Screen it</Button>
      </form>
      {(touched || check.state === "ok") && <SubjectHint id="onboard-hint" check={check} />}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-ink-soft">Or try:</span>
        {[SCREEN_EXAMPLES[0], SCREEN_EXAMPLES[1], SCREEN_EXAMPLES[3]].map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => go(ex.address)}
            className="min-h-10 rounded-full border-2 border-line bg-card px-3 font-mono text-xs hover:bg-paper-2"
          >
            {ex.short}
          </button>
        ))}
      </div>
    </li>
  );
}
