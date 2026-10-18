"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Argus } from "@/components/brand/argus";
import { cn } from "@/lib/cn";

const STEPS = ["Decoding the address", "Fetching on-chain history", "Checking Hera's labels", "Scoring and explaining"];
// Real screens take 1–8 s; advance the copy on a gentle schedule and hold on the last step.
const AT = [0, 900, 2600, 4400];

/** Argus scanning while a screen runs. Progress copy is approximate by design. */
export function ScanningState({ address }: { address?: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = AT.slice(1).map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <section role="status" aria-live="polite" className="brutal flex flex-wrap items-center gap-6 p-6">
      <Argus mood="scanning" size={132} title="Argus is scanning" />
      <div className="flex min-w-0 flex-1 basis-[260px] flex-col gap-3">
        <span className="eyebrow">Screening</span>
        {address && <span className="truncate font-mono text-sm">{address}</span>}
        <AnimatePresence mode="wait">
          <motion.h2
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-[26px] leading-tight font-extrabold"
          >
            {STEPS[step]}…
          </motion.h2>
        </AnimatePresence>
        <ol className="flex flex-wrap gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={cn(
                "rounded-full border-2 border-line px-2.5 py-0.5 text-xs font-bold transition-colors",
                i < step ? "bg-peacock-soft" : i === step ? "bg-sun text-[#17130F]" : "bg-card text-ink-soft",
              )}
            >
              {s.split(" ")[0]}
              <span className="sr-only">{i < step ? " done" : i === step ? " in progress" : " pending"}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-ink-soft">Public chain data can be slow. Most screens finish within 8 seconds.</p>
      </div>
    </section>
  );
}
