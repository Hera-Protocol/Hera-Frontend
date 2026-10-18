"use client";

import { useState } from "react";
import { Argus } from "@/components/brand/argus";
import { cn } from "@/lib/cn";

const FACTS = [
  {
    title: "One Stellar address can hide thousands of customers.",
    body: "Hera decodes muxed IDs and memos so you screen the actual person, not the exchange in front of them.",
  },
  {
    title: "Every audit entry carries the hash of the one before.",
    body: "Change one record and the chain breaks. Your auditor can recompute it with one click.",
  },
  {
    title: "Travel Rule data travels as IVMS101.",
    body: "Hera checks the originator and beneficiary fields your jurisdiction needs before anything settles.",
  },
];

/** The dark story panel beside the signup form. Manual dots, no autoplay. */
export function SignupStory() {
  const [index, setIndex] = useState(0);
  const fact = FACTS[index]!;
  return (
    <aside className="relative flex min-w-0 flex-[1_1_440px] flex-col items-center justify-center gap-7 overflow-hidden border-t-2 border-line bg-ink px-6 py-14 text-paper sm:px-[clamp(24px,4vw,64px)] lg:border-t-0 lg:border-l-2 dark:bg-card dark:text-ink">
      <div className="dot-grid absolute inset-0 opacity-40 invert dark:invert-0" aria-hidden />
      {/* Argus draws with --line; on the ink panel the outline has to flip to paper. */}
      <div className="relative animate-float [--line:var(--paper)] dark:[--line:var(--ink)]">
        <Argus size={200} title="Argus the peacock" />
      </div>
      <div className="relative flex max-w-[420px] flex-col gap-3.5 text-center" aria-live="polite">
        <span className="font-mono text-xs tracking-[0.12em] text-sun uppercase">Did you know?</span>
        <h2 className="text-[32px] leading-[1.1] font-extrabold">{fact.title}</h2>
        <p className="text-base leading-relaxed opacity-80">{fact.body}</p>
      </div>
      <div className="relative flex gap-1" role="group" aria-label="Facts">
        {FACTS.map((f, i) => (
          <button
            key={f.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Fact ${i + 1} of ${FACTS.length}`}
            aria-pressed={i === index}
            className="grid size-10 place-items-center rounded-full"
          >
            <span className={cn("block h-2 rounded-full transition-all", i === index ? "w-[22px] bg-sun" : "w-2 bg-paper/40 dark:bg-ink/40")} />
          </button>
        ))}
      </div>
    </aside>
  );
}
