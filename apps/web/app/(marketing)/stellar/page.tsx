import type { Metadata } from "next";
import { GuideBody, GuideHero } from "@/components/marketing/stellar/guide";

export const metadata: Metadata = {
  title: "Working with Stellar",
  description:
    "A guide for builders: how muxed accounts (SEP-23), memos and SEP standards differ from EVM, and what correct compliance handling on Stellar requires.",
};

export default function StellarGuidePage() {
  return (
    <article aria-labelledby="guide-title">
      <GuideHero />
      <GuideBody />
    </article>
  );
}
