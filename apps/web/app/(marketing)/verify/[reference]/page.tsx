import type { Metadata } from "next";
import { VerifyReport } from "@/components/marketing/verify/verify-report";

type Props = { params: Promise<{ reference: string }> };

/** The reference is display-only context; keep it short and printable. */
function cleanReference(raw: string): string {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // keep the raw segment
  }
  return value.replace(/[^\w.-]/g, "").slice(0, 48);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const reference = cleanReference((await params).reference);
  return {
    title: reference ? `Verify ${reference}` : "Verify a report",
    description: "Check that a Hera compliance report is genuine and unaltered. The PDF is hashed in your browser; only its SHA-256 fingerprint is sent.",
    robots: { index: false },
  };
}

export default async function VerifyReferencePage({ params }: Props) {
  const reference = cleanReference((await params).reference);
  return <VerifyReport reference={reference || undefined} />;
}
