import type { Metadata } from "next";
import { DevelopersSection } from "@/components/marketing/home/developers-section";
import { EvmSection } from "@/components/marketing/home/evm-section";
import { Faq } from "@/components/marketing/home/faq";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { Hero } from "@/components/marketing/home/hero";
import { HowItWorks } from "@/components/marketing/home/how-it-works";
import { Marquee } from "@/components/marketing/home/marquee";
import { PricingSection } from "@/components/marketing/home/pricing-section";
import { StellarSection } from "@/components/marketing/home/stellar-section";
import { TravelRuleSection } from "@/components/marketing/home/travel-rule-section";

export const metadata: Metadata = {
  title: { absolute: "Hera: compliance that never blinks" },
  description:
    "KYT, AML and the Travel Rule for Stellar and EVM. Hera screens wallets and scores every transaction with its own intelligence, natively handling muxed accounts, memos and SEPs.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <HowItWorks />
      <StellarSection />
      <EvmSection />
      <TravelRuleSection />
      <DevelopersSection />
      <PricingSection />
      <Faq />
      <FinalCta />
    </>
  );
}
