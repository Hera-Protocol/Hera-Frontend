import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

function HomeLink() {
  return (
    <Link href="/" className="self-start rounded-md" aria-label="Hera home">
      <Logo size={32} />
    </Link>
  );
}

/** Login and signup: the form on dotted paper, a story panel beside it (below it on phones). */
export function AuthSplit({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap bg-paper">
      <main id="main" className="dot-grid flex min-w-0 flex-[999_1_520px] flex-col gap-8 px-4 py-8 sm:px-[clamp(20px,5vw,72px)]">
        <HomeLink />
        {children}
      </main>
      {aside}
    </div>
  );
}

/** Single-purpose pages (reset, invite, verify): logo on top, one column centered. */
export function AuthCentered({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main id="main" className="dot-grid flex min-h-screen flex-col gap-10 bg-paper px-4 py-8 sm:px-[clamp(16px,4vw,56px)]">
      <HomeLink />
      <div className={cn("mx-auto flex w-full flex-col gap-2.5", wide ? "max-w-[500px]" : "max-w-[480px]")}>{children}</div>
    </main>
  );
}

/** Mono step label above a card, e.g. "STEP 1 · ASK FOR A LINK". */
export function StepLabel({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs tracking-[0.1em] text-ink-soft uppercase">{children}</span>;
}

const CARD_TONES = {
  card: "bg-card",
  sent: "bg-peacock-soft",
  verified: "bg-risk-low-soft",
  expired: "bg-risk-medium-soft",
  error: "bg-risk-severe-soft",
} as const;

export function AuthCard({ tone = "card", className, ...props }: ComponentProps<"section"> & { tone?: keyof typeof CARD_TONES }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-[20px] border-2 border-line p-6 shadow-[6px_6px_0_var(--shadow-color)] sm:p-8",
        CARD_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** The tilted icon tile at the top of status cards. */
export function IconTile({ children, tone = "card" }: { children: ReactNode; tone?: "card" | "sun" }) {
  return (
    <span
      className={cn(
        "grid size-16 -rotate-6 place-items-center rounded-[18px] border-2 border-line shadow-hard-sm",
        tone === "sun" ? "bg-sun text-[#17130F]" : "bg-card text-ink",
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}
