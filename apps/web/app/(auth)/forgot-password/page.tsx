import type { Metadata } from "next";
import { AuthCentered } from "@/components/auth/auth-layout";
import { ForgotPasswordFlow } from "./forgot-flow";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCentered>
      <ForgotPasswordFlow />
    </AuthCentered>
  );
}
