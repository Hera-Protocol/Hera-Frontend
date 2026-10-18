import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFallback } from "@/components/auth/auth-fallback";
import { AuthSplit } from "@/components/auth/auth-layout";
import { Argus } from "@/components/brand/argus";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthSplit
      aside={
        <aside className="flex min-w-0 flex-[1_1_440px] flex-col items-center justify-center gap-6 border-t-2 border-line bg-sun px-6 py-14 text-[#17130F] sm:px-[clamp(24px,4vw,64px)] lg:border-t-0 lg:border-l-2">
          <div className="animate-float">
            <Argus size={200} title="Argus the peacock, keeping watch" />
          </div>
          <div className="flex max-w-[400px] flex-col gap-3 text-center">
            <span className="font-mono text-xs tracking-[0.12em] uppercase">While you were away</span>
            <h2 className="text-[30px] leading-[1.1] font-extrabold">Hera rescreens every watched wallet every two minutes.</h2>
            <p className="text-base leading-relaxed">Anything new waits for you in the alerts queue, with the reasons attached.</p>
          </div>
        </aside>
      }
    >
      <Suspense fallback={<AuthFallback />}>
        <LoginForm />
      </Suspense>
    </AuthSplit>
  );
}
