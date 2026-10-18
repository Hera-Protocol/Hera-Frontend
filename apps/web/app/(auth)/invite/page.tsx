import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFallback } from "@/components/auth/auth-fallback";
import { AuthCentered } from "@/components/auth/auth-layout";
import { AcceptInviteFlow } from "./accept-flow";

export const metadata: Metadata = { title: "Join your team" };

export default function InvitePage() {
  return (
    <AuthCentered wide>
      <Suspense fallback={<AuthFallback />}>
        <AcceptInviteFlow />
      </Suspense>
    </AuthCentered>
  );
}
