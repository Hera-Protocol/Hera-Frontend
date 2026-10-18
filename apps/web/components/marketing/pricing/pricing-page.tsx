import { Check, Minus } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Reveal, Stagger } from "../motion";
import { ENTERPRISE_CONTACT, PlanCard, type Plan } from "./plan-card";

const PLANS: Plan[] = [
  {
    name: "Developer",
    blurb: "For builders and startups shipping on Stellar and EVM.",
    price: "Self-serve",
    tone: "card",
    cta: { href: "/signup", label: "Start building" },
    features: [
      <>
        <strong className="font-mono text-[15px]">@hera/sdk</strong> and REST API
      </>,
      "Wallet monitoring with webhooks",
      "Real-time transaction tracking",
      "Sanctions and exposure screening",
      "Risk scores with every reason",
      "Muxed accounts and memos, natively",
      "Screening evidence PDFs",
    ],
  },
  {
    name: "Enterprise",
    blurb: "For larger organizations that need compliance at scale.",
    price: "Custom",
    tone: "ink",
    badge: "FULL KYT + AML",
    cta: { href: ENTERPRISE_CONTACT, label: "Talk to us" },
    features: [
      "Everything in Developer",
      "Full KYT and AML programme",
      "Advanced risk scoring (multi-hop exposure)",
      "Travel Rule with IVMS101 and VASP discovery",
      "Alerts, cases and compliance audit PDFs",
      "SSO, roles and audit export",
      "Dedicated integration support",
    ],
  },
];

type Cell = true | false | string;

const ROWS: [string, Cell, Cell][] = [
  ["Stellar (incl. muxed accounts, memos, SEP-1)", true, true],
  ["Ethereum", true, true],
  ["Base, Arbitrum, Optimism, Polygon", "Soon", "Soon"],
  ["Screening API and SDK", true, true],
  ["Watched wallets and signed webhooks", true, true],
  ["Direct and first-hop exposure", true, true],
  ["Multi-hop exposure and custom rules", false, true],
  ["Alerts queue with dispositions", false, true],
  ["Travel Rule (IVMS101, VASP discovery)", false, true],
  ["Compliance audit report PDFs", "Evidence only", true],
  ["SSO, custom roles", false, true],
  ["Dedicated integration support", false, true],
];

function CellValue({ value }: { value: Cell }) {
  if (value === true)
    return (
      <>
        <Check className="mx-auto size-5 text-peacock" strokeWidth={3} aria-hidden />
        <span className="sr-only">Included</span>
      </>
    );
  if (value === false)
    return (
      <>
        <Minus className="mx-auto size-5 text-ink-soft/60" aria-hidden />
        <span className="sr-only">Not included</span>
      </>
    );
  return <span className="text-sm">{value}</span>;
}

export function PricingHero() {
  return (
    <section aria-labelledby="pricing-title" className="mx-auto flex max-w-[1200px] flex-col items-center gap-3.5 px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-[72px]">
      <Reveal className="flex flex-col items-center gap-3.5">
        <span className="eyebrow text-[13px]">Pricing</span>
        <h1 id="pricing-title" className="max-w-[900px] text-[clamp(40px,6vw,76px)] leading-[0.98] font-extrabold">
          Start with the SDK. Grow into full compliance.
        </h1>
        <p className="max-w-[680px] text-lg leading-relaxed text-ink-soft sm:text-[19px]">
          Two plans, built for where you are. Builders get monitoring and screening on day one; larger teams get KYT, AML and the Travel Rule with people
          who help them ship it.
        </p>
      </Reveal>
    </section>
  );
}

export function PricingPlans() {
  return (
    <section aria-label="Plans" className="mx-auto max-w-[1060px] px-4 pt-4 pb-[72px] sm:px-6">
      <Stagger className="grid gap-7 md:grid-cols-2">
        {PLANS.map((p) => (
          <PlanCard key={p.name} plan={p} ctaFirst headingLevel="h2" />
        ))}
      </Stagger>
    </section>
  );
}

export function CompareTable() {
  return (
    <section aria-labelledby="compare-title" className="mx-auto max-w-[1060px] px-4 pb-20 sm:px-6">
      <Reveal>
        <h2 id="compare-title" className="mb-5 text-[clamp(32px,4vw,40px)] font-extrabold">
          Compare plans
        </h2>
      </Reveal>
      <Reveal delay={0.05} className="brutal overflow-hidden rounded-[18px]">
        {/* Focusable so keyboard users can scroll it sideways on narrow screens. */}
        <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-labelledby="compare-title">
          <table className="w-full min-w-[560px] border-collapse text-[15px]">
            <thead>
              <tr className="border-b-2 border-line">
                <th scope="col" className="px-5 py-4 text-left sm:px-[22px]">
                  Capability
                </th>
                <th scope="col" className="w-[150px] px-4 py-4 sm:w-[180px]">
                  Developer
                </th>
                <th scope="col" className="w-[150px] bg-sun px-4 py-4 text-[#17130F] sm:w-[180px]">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([name, dev, ent]) => (
                <tr key={name} className="border-t border-dashed border-line/25 transition-colors hover:bg-paper">
                  <th scope="row" className="px-5 py-[13px] text-left font-medium sm:px-[22px]">
                    {name}
                  </th>
                  <td className="px-4 py-[13px] text-center font-bold">
                    <CellValue value={dev} />
                  </td>
                  <td className="bg-sun/15 px-4 py-[13px] text-center font-bold">
                    <CellValue value={ent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}

export function PricingCta() {
  return (
    <section aria-labelledby="pricing-cta-title" className="mx-auto max-w-[1060px] px-4 pb-24 sm:px-6">
      <Reveal className="flex flex-wrap items-center justify-between gap-5 rounded-[22px] border-2 border-line bg-blush p-7 shadow-[6px_6px_0_var(--shadow-color)] sm:p-9 dark:bg-blush-soft">
        <div className="max-w-[600px] text-ink">
          <h2 id="pricing-cta-title" className="text-[clamp(28px,4vw,36px)] leading-[1.05] font-extrabold">
            Not sure which plan fits?
          </h2>
          <p className="mt-2 text-[17px]">Tell us what you&apos;re building. We&apos;ll tell you honestly which plan you need, even if it&apos;s the smaller one.</p>
        </div>
        <a href={ENTERPRISE_CONTACT} className={cn(buttonStyles({ variant: "ink", size: "lg" }))}>
          Book a call
        </a>
      </Reveal>
    </section>
  );
}
