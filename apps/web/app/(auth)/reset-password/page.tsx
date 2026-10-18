import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFallback } from "@/components/auth/auth-fallback";
import { AuthCentered } from "@/components/auth/auth-layout";
import { ResetPasswordFlow } from "./reset-flow";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthCentered>
      <Suspense fallback={<AuthFallback />}>
        <ResetPasswordFlow />
      </Suspense>
    </AuthCentered>
  );
}
