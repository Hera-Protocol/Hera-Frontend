import Link from "next/link";
import { Stagger } from "../motion";
import { ENTERPRISE_CONTACT, PlanCard, type Plan } from "../pricing/plan-card";
import { Container, SectionHeading } from "../section";

const PLANS: Plan[] = [
  {
    name: "Developer",
    blurb: "For builders and startups.",
    price: "Self-serve",
    tone: "card",
    features: ["SDK and REST API", "Wallet monitoring", "Real-time transaction tracking", "Sanctions screening", "Risk scores with reasons"],
    cta: { href: "/signup", label: "Start building" },
  },
  {
    name: "Enterprise",
    blurb: "For larger organizations that need compliance at scale.",
    price: "Custom",
    tone: "sun",
    badge: "FULL KYT + AML",
    features: [
      "Everything in Developer",
      "Full KYT and AML",
      "Advanced risk scoring",
      "Travel Rule (IVMS101)",
      "Alerts and case management",
      "SSO, roles and audit export",
      "Dedicated integration support",
    ],
    cta: { href: ENTERPRISE_CONTACT, label: "Talk to us" },
  },
];

export function PricingSection() {
  return (
    <Container id="pricing" aria-labelledby="pricing-title" className="flex scroll-mt-20 flex-col gap-10 pt-10 pb-20 sm:pb-[104px]">
      <SectionHeading id="pricing-title" align="center" eyebrow="Pricing" title="Two plans. No surprises." />
      <Stagger className="mx-auto grid w-full max-w-[980px] gap-7 md:grid-cols-2">
        {PLANS.map((p) => (
          <PlanCard key={p.name} plan={p} />
        ))}
      </Stagger>
      <p className="text-center text-[15px] text-ink-soft">
        <Link href="/pricing" className="font-semibold text-ink underline decoration-sun decoration-[3px] underline-offset-4 hover:text-iris">
          Compare the plans in detail
        </Link>
      </p>
    </Container>
  );
}
