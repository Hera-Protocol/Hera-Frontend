import type { Metadata } from "next";
import { CompareTable, PricingCta, PricingHero, PricingPlans } from "@/components/marketing/pricing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Two Hera plans: Developer, self-serve with the SDK, screening and wallet monitoring; and Enterprise, custom, with full KYT, AML and the Travel Rule.",
};

export default function PricingPage() {
  return (
    <>
      <PricingHero />
      <PricingPlans />
      <CompareTable />
      <PricingCta />
    </>
  );
}
