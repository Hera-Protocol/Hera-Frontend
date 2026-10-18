import type { Metadata } from "next";
import { VerifyReport } from "@/components/marketing/verify/verify-report";

export const metadata: Metadata = {
  title: "Verify a report",
  description: "Check that a Hera compliance report is genuine and unaltered. The PDF is hashed in your browser; only its SHA-256 fingerprint is sent.",
};

export default function VerifyPage() {
  return <VerifyReport />;
}
