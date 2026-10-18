import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { StaggerItem } from "../motion";

export const ENTERPRISE_CONTACT = "mailto:hello@heralayer.com?subject=Hera%20Enterprise";

type Tone = "card" | "sun" | "ink";

export interface Plan {
  name: string;
  blurb: string;
  price: string;
  features: ReactNode[];
  cta: { href: string; label: string };
  tone: Tone;
  badge?: string;
}

function Cta({ href, label, tone, className }: { href: string; label: string; tone: Tone; className?: string }) {
  const variant = tone === "sun" ? "ink" : tone === "ink" ? "secondary" : "primary";
  const classes = buttonStyles({ variant, size: "lg", className: cn("w-full", className) });
  return href.startsWith("mailto:") ? (
    <a href={href} className={classes}>
      {label}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {label}
    </Link>
  );
}

/**
 * One pricing plan. `ink` cards scope the dark palette inside, so they stay
 * dark in both themes; `sun` cards keep #17130F text, since sun never changes.
 */
export function PlanCard({ plan, ctaFirst = false, headingLevel = "h3" }: { plan: Plan; ctaFirst?: boolean; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const { tone } = plan;
  const body = (
    <div
      data-theme={tone === "ink" ? "dark" : undefined}
      className={cn(
        "flex h-full flex-col gap-5 rounded-[20px] p-7 sm:p-8",
        tone === "card" && "bg-card text-ink",
        tone === "sun" && "bg-sun text-[#17130F]",
        tone === "ink" && "bg-paper text-ink",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <Heading className="text-[30px] font-extrabold sm:text-[34px]">{plan.name}</Heading>
        <p className={cn("text-base", tone !== "sun" && "text-ink-soft")}>{plan.blurb}</p>
      </div>
      <p className="font-display text-[40px] leading-none font-extrabold sm:text-[44px]">{plan.price}</p>
      {ctaFirst && <Cta {...plan.cta} tone={tone} />}
      <ul className="flex flex-1 flex-col gap-3 text-base">
        {plan.features.map((f, i) => (
          <li key={i} className="flex gap-2.5">
            <Check className={cn("mt-1 size-4 shrink-0", tone === "card" && "text-peacock", tone === "ink" && "text-sun")} strokeWidth={3} aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {!ctaFirst && <Cta {...plan.cta} tone={tone} />}
    </div>
  );

  return (
    <StaggerItem
      as="article"
      lift
      className={cn(
        "relative rounded-[22px] border-2 border-line",
        tone === "ink" ? "shadow-[6px_6px_0_var(--peacock)]" : "shadow-[6px_6px_0_var(--shadow-color)]",
      )}
    >
      {plan.badge && (
        <span
          className={cn(
            "absolute -top-4 right-6 z-10 rotate-3 rounded-lg border-2 border-line px-2.5 py-1.5 font-mono text-xs tracking-[0.1em]",
            tone === "ink" ? "bg-sun text-[#17130F]" : "bg-ink text-paper",
          )}
        >
          {plan.badge}
        </span>
      )}
      {body}
    </StaggerItem>
  );
}
