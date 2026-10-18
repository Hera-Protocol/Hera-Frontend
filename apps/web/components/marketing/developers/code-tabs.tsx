"use client";

import { motion } from "motion/react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { CodeBody, CodeFrame } from "../code/code-window";
import { CopyButton } from "../code/copy-button";
import { GUARD_SAMPLE, TRAVEL_RULE_SAMPLE, WEBHOOK_SAMPLE } from "../code/samples";

const TABS = [
  { file: "guard.ts", code: GUARD_SAMPLE, label: "Guard a send" },
  { file: "webhook.ts", code: WEBHOOK_SAMPLE, label: "Verify a webhook" },
  { file: "travel-rule.ts", code: TRAVEL_RULE_SAMPLE, label: "File a Travel Rule transfer" },
];

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs; Tab moves into the code. */
export function CodeTabs() {
  const base = useId();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (i: number) => {
    const next = (i + TABS.length) % TABS.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") select(active + 1);
    else if (e.key === "ArrowLeft") select(active - 1);
    else if (e.key === "Home") select(0);
    else if (e.key === "End") select(TABS.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <CodeFrame shadow="iris">
      <div className="flex items-center gap-2 border-b border-line/20 px-2.5 py-2 sm:px-3.5">
        <div role="tablist" aria-label="SDK examples" onKeyDown={onKeyDown} className="scrollbar-none flex min-w-0 gap-1 overflow-x-auto font-mono text-xs">
          {TABS.map((t, i) => {
            const on = i === active;
            return (
              <button
                key={t.file}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                id={`${base}-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`${base}-panel-${i}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn("relative min-h-9 shrink-0 rounded-md px-2.5 transition-colors", on ? "text-[#17130F]" : "text-ink-soft hover:text-ink")}
              >
                {on && (
                  <motion.span
                    layoutId={`${base}-pill`}
                    className="absolute inset-0 rounded-md bg-sun"
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    aria-hidden
                  />
                )}
                <span className="relative">{t.file}</span>
              </button>
            );
          })}
        </div>
        <CopyButton value={TABS[active]!.code} label={`Copy ${TABS[active]!.file}`} className="ml-auto" />
      </div>
      {TABS.map((t, i) => (
        <div key={t.file} id={`${base}-panel-${i}`} role="tabpanel" aria-labelledby={`${base}-tab-${i}`} hidden={i !== active}>
          {i === active && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}>
              <CodeBody code={t.code} label={`${t.label}: ${t.file}`} className="lg:h-[480px] lg:overflow-y-auto" />
            </motion.div>
          )}
        </div>
      ))}
    </CodeFrame>
  );
}
