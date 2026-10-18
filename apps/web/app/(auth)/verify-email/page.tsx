import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFallback } from "@/components/auth/auth-fallback";
import { AuthCentered } from "@/components/auth/auth-layout";
import { VerifyEmailFlow } from "./verify-flow";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <AuthCentered>
      <Suspense fallback={<AuthFallback />}>
        <VerifyEmailFlow />
      </Suspense>
    </AuthCentered>
  );
}
