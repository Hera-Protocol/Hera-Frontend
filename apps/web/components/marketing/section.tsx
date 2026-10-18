import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "./motion";

/** Page-width container used by every marketing section. */
export function Container({
  className,
  children,
  as: As = "section",
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return (
    <As className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6", className)} {...rest}>
      {children}
    </As>
  );
}

/** Eyebrow + heading + lede, revealed on scroll. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  id,
  align = "left",
  className,
  eyebrowClassName,
  ledeClassName,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** id for the h2, so the section can be `aria-labelledby` it. */
  id?: string;
  align?: "left" | "center";
  className?: string;
  eyebrowClassName?: string;
  ledeClassName?: string;
}) {
  return (
    <Reveal className={cn("flex max-w-[760px] flex-col gap-3", align === "center" && "mx-auto items-center text-center", className)}>
      {eyebrow && <span className={cn("eyebrow text-[13px]", eyebrowClassName)}>{eyebrow}</span>}
      <h2 id={id} className="text-[clamp(36px,5vw,60px)] leading-[1.02] font-extrabold">
        {title}
      </h2>
      {lede && <p className={cn("text-lg leading-relaxed text-ink-soft sm:text-[19px]", ledeClassName)}>{lede}</p>}
    </Reveal>
  );
}
