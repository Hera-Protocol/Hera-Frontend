"use client";

import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Single-choice toggle (a radiogroup). One stop in the tab order; arrow
 * keys, Home and End move the choice, like native radio buttons. The active
 * pill slides between options.
 */
export function ToggleGroup<T extends string>({
  label,
  labelId,
  value,
  onChange,
  options,
  className,
}: {
  /** Accessible name; pass `labelId` instead to point at a visible label. */
  label?: string;
  labelId?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const pillId = useId();
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const move = (next: number) => {
    const i = (next + options.length) % options.length;
    onChange(options[i]!.value);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") move(index + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(index - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(options.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="radiogroup"
      aria-label={labelId ? undefined : label}
      aria-labelledby={labelId}
      onKeyDown={onKeyDown}
      className={cn("flex rounded-[12px] border-2 border-line bg-card p-1 text-sm font-bold", className)}
    >
      {options.map((o, i) => {
        const on = i === index;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn("relative min-h-10 flex-1 rounded-[8px] px-3.5 transition-colors", on ? "text-paper" : "text-ink hover:bg-paper-2")}
          >
            {on && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-[8px] bg-ink"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                aria-hidden
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
