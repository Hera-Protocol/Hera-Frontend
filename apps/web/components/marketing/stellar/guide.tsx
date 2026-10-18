import { decodeMuxedAccount } from "@hera/core";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BAND_STYLE } from "@/lib/risk";
import { MUXED_ACCOUNT_CHARS, SAMPLE_MUXED } from "../constants";
import { Reveal, Stagger, StaggerItem } from "../motion";

const decoded = decodeMuxedAccount(SAMPLE_MUXED);

export function GuideHero() {
  return (
    <header className="border-b-2 border-line">
      <div data-theme="dark" className="bg-paper text-ink">
        <Reveal className="mx-auto flex max-w-[1000px] flex-col gap-[18px] px-4 pt-16 pb-14 sm:px-6 sm:pt-20 sm:pb-[72px]">
          <span className="eyebrow text-[13px] text-sun">Guide · for builders on Stellar</span>
          <h1 id="guide-title" className="text-[clamp(44px,6.5vw,82px)] leading-[0.96] font-extrabold">
            Working with Stellar
          </h1>
          <p className="max-w-[760px] text-lg leading-relaxed text-ink-soft sm:text-xl">
            Stellar&apos;s architecture is powerful but differs from EVM chains in ways that matter for compliance. Tooling built for EVM often mishandles
            these structures and silently produces incomplete results. Here&apos;s what correct handling requires.
          </p>
          <ul className="flex flex-wrap gap-2.5 font-mono text-[13px]" aria-label="Topics">
            {["SEP-23", "Memos", "SEP-1 · 10 · 12 · 31", "8 min read"].map((t) => (
              <li key={t} className="rounded-full border-2 border-line px-3 py-1">
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </header>
  );
}

function Chapter({ label, tone, title, id, children, aside, reverse }: {
  label: string;
  tone: string;
  title: string;
  id: string;
  children: ReactNode;
  aside: ReactNode;
  reverse?: boolean;
}) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-8 lg:items-start", reverse ? "lg:flex-row-reverse" : "lg:flex-row")}>
      <Reveal className="flex min-w-0 flex-1 flex-col gap-3.5">
        <span className={cn("self-start rounded-lg border-2 border-line px-2 py-0.5 font-mono text-[13px]", tone)}>{label}</span>
        <h2 id={id} className="text-[clamp(34px,4.4vw,42px)] leading-none font-extrabold">
          {title}
        </h2>
        <div className="flex flex-col gap-3.5 text-[17px] leading-[1.7]">{children}</div>
      </Reveal>
      <Reveal delay={0.1} y={30} className="w-full min-w-0 flex-1">
        {aside}
      </Reveal>
    </section>
  );
}

function MuxedCard() {
  return (
    <figure className="flex flex-col gap-3.5 rounded-[18px] border-2 border-line bg-card p-5 shadow-[6px_6px_0_var(--shadow-color)] sm:p-[22px]">
      <figcaption className="eyebrow text-xs">One address, two facts</figcaption>
      <p className="rounded-[10px] border-2 border-dashed border-line bg-paper p-2.5 font-mono text-[13px] leading-[1.6] break-all">
        <span className="bg-peacock-soft">{SAMPLE_MUXED.slice(0, MUXED_ACCOUNT_CHARS)}</span>
        <span className="bg-sun/30">{SAMPLE_MUXED.slice(MUXED_ACCOUNT_CHARS)}</span>
      </p>
      <div className="flex flex-col gap-2.5">
        <div className="rounded-[12px] border-2 border-line bg-peacock-soft px-3 py-2.5">
          <strong className="text-[13px]">Account (holds the balance)</strong>
          <div className="font-mono text-xs break-all">{decoded?.account}</div>
        </div>
        <div className="rounded-[12px] border-2 border-line bg-sun/30 px-3 py-2.5">
          <strong className="text-[13px]">Muxed ID (the customer)</strong>
          <div className="font-display text-[30px] font-extrabold">{decoded?.id.toString()}</div>
        </div>
      </div>
    </figure>
  );
}

const ANCHOR_STEPS: { tag: string; tone: string; body: ReactNode }[] = [
  { tag: "SEP-1", tone: "bg-iris-soft", body: <>Account sets <code className="font-mono">home_domain</code>, domain publishes stellar.toml</> },
  { tag: "verified", tone: "bg-peacock-soft", body: "The toml lists the account back, so the claim is verified" },
  { tag: "SEP-10", tone: "bg-blush-soft", body: "Authentication endpoint" },
  { tag: "SEP-12", tone: "bg-blush-soft", body: "KYC fields, mapped to IVMS101" },
  { tag: "SEP-31", tone: "bg-blush-soft", body: "Cross-border payments between anchors" },
];

function AnchorCard() {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border-2 border-line bg-card p-5 shadow-[6px_6px_0_var(--iris)] sm:p-[22px]">
      <h3 className="eyebrow text-xs font-normal">How an anchor is found</h3>
      <Stagger as="ol" className="flex flex-col gap-2.5 text-[15px]">
        {ANCHOR_STEPS.map((s) => (
          <StaggerItem as="li" key={s.tag} className="flex gap-2.5">
            <span className={cn("h-fit shrink-0 rounded-md border-2 border-line px-1.5 font-mono font-medium", s.tone)}>
              {s.tag === "verified" ? (
                <>
                  <Check className="my-1 size-3.5" strokeWidth={3} aria-hidden />
                  <span className="sr-only">Verified</span>
                </>
              ) : (
                s.tag
              )}
            </span>
            <span>{s.body}</span>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

const MEMO_ROWS = [
  { memo: "1001", score: 30, band: "medium" as const },
  { memo: "1002", score: 4, band: "low" as const },
  { memo: "1003", score: 6, band: "low" as const },
];

function MemoCard() {
  return (
    <div className="overflow-hidden rounded-[18px] border-2 border-line bg-card shadow-[6px_6px_0_var(--blush)]">
      <h3 className="border-b-2 border-line px-[18px] py-3.5 font-mono text-xs font-normal tracking-[0.1em]">SHARED ACCOUNT GBXK…Q2LM</h3>
      <div className="flex flex-col gap-2 px-[18px] py-3.5 text-sm">
        <Stagger as="ul" className="flex flex-col gap-2">
          {MEMO_ROWS.map((r) => (
            <StaggerItem
              as="li"
              key={r.memo}
              className={cn("flex justify-between gap-2.5 rounded-[10px] border-2 border-line px-2.5 py-2", BAND_STYLE[r.band].soft)}
            >
              <span>
                memo id <strong>{r.memo}</strong>
              </span>
              <span className={cn("font-mono", BAND_STYLE[r.band].text)}>
                score {r.score} · {BAND_STYLE[r.band].label.toLowerCase()}
              </span>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-1 text-[13px] text-ink-soft">Three customers, three different answers. Screening the account alone would average them away.</p>
      </div>
    </div>
  );
}

export function GuideBody() {
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-16 px-4 pt-16 pb-24 sm:px-6 sm:pt-[72px]">
      <Chapter id="muxed" label="01 · SEP-23" tone="bg-sun text-[#17130F]" title="Muxed accounts" aside={<MuxedCard />}>
        <p>A muxed account lets one Stellar account represent many distinct users behind one address. Exchanges, custodians and anchors use this all the time.</p>
        <p>
          <strong>The pitfall:</strong> generic tools see the shared address as one entity and lose the sub-identity. Screening, Travel Rule and
          record-keeping all depend on knowing who the counterparty actually is.
        </p>
        <p>
          <strong>What correct handling requires:</strong> recognising muxed addresses, resolving them to the right underlying identifier, and carrying
          that distinction through every downstream check and record.
        </p>
      </Chapter>

      <Chapter id="seps" label="02 · SEPs" tone="bg-iris-soft" title="SEP standards" aside={<AnchorCard />} reverse>
        <p>
          Stellar Ecosystem Proposals define much of how real-world value moves on Stellar: anchors, deposits and withdrawals, and authorization flows.
        </p>
        <p>Compliance tooling has to understand the relevant SEPs to interpret transactions correctly, instead of treating them as opaque transfers.</p>
      </Chapter>

      <Chapter id="memos" label="03 · Memos" tone="bg-blush-soft" title="Memos" aside={<MemoCard />}>
        <p>Stellar transactions often carry memos that matter operationally, for example routing funds to one end user at a shared address.</p>
        <p>Ignoring or mishandling memos can mean missing the real counterparty. Hera scores the memo&apos;s own transfers separately from the shared account.</p>
      </Chapter>

      <Reveal as="section" aria-labelledby="takeaway" className="flex flex-col gap-3.5 rounded-[22px] border-2 border-line bg-sun p-7 text-[#17130F] shadow-[8px_8px_0_var(--shadow-color)] sm:p-9">
        <h2 id="takeaway" className="text-[clamp(30px,4vw,38px)] leading-[1.05] font-extrabold">
          The takeaway for builders
        </h2>
        <p className="text-lg leading-[1.65]">
          If you build on Stellar and your tooling was designed for EVM, assume these areas need explicit attention. They aren&apos;t edge cases.
          They&apos;re how value actually moves on the network, and getting them wrong undermines everything built on top.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/developers" variant="ink">
            See how the SDK handles it
          </ButtonLink>
          <ButtonLink href="/#stellar" variant="secondary">
            Decode a muxed address
          </ButtonLink>
        </div>
      </Reveal>

      <aside aria-label="Disclaimer" className="border-t-2 border-dashed border-line pt-[18px] text-sm leading-relaxed text-ink-soft">
        This is educational reference material. It describes public Stellar standards and common pitfalls; it does not describe Hera Protocol&apos;s
        proprietary implementation. We share deeper practical guidance through the Stellar community. See our events and talks.
      </aside>
    </div>
  );
}
