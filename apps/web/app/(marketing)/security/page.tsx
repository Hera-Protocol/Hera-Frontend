import type { Metadata } from "next";
import { DisclosureCta, SecurityGrid, SecurityHero } from "@/components/marketing/security/security-page";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Hera protects your data, keys and evidence: argon2id passwords, hashed sessions and API keys, signed webhooks, tenant isolation, a tamper-evident audit log and verifiable reports.",
};

export default function SecurityPage() {
  return (
    <>
      <SecurityHero />
      <SecurityGrid />
      <DisclosureCta />
    </>
  );
}
