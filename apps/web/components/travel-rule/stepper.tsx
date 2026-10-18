"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Wizard steps: done (ink, clickable), current (sun), upcoming (dashed, clickable to validate forward). */
export function Stepper({ steps, current, onSelect }: { steps: readonly { label: string }[]; current: number; onSelect: (index: number) => void }) {
  return (
    <ol aria-label="Steps" className="flex flex-wrap gap-2 text-sm font-bold">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={active ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${s.label}${done ? ", done" : active ? ", current" : ""}`}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-full px-3.5",
                done && "bg-ink text-paper",
                active && "border-2 border-line bg-sun text-[#17130F] shadow-hard-sm",
                !done && !active && "border-2 border-dashed border-line hover:bg-paper-2",
              )}
            >
              {i + 1} {s.label}
              {done && <Check aria-hidden strokeWidth={3} className="size-3.5" />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
