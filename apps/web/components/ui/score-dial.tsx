"use client";

import type { RiskBand } from "@hera/core";
import { motion } from "motion/react";
import { BAND_STYLE } from "@/lib/risk";

const R = 44;
const C = 2 * Math.PI * R;

export function ScoreDial({ score, band, size = 132 }: { score: number; band: RiskBand; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Risk score ${score} out of 100, ${band}`}>
        <circle cx="60" cy="60" r="52" fill="var(--card)" stroke="var(--line)" strokeWidth="3" />
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeOpacity="0.1" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={BAND_STYLE[band].ring}
          strokeWidth="10"
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - score / 100) }}
          transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[40px] leading-none font-extrabold">{score}</span>
        <span className="font-mono text-[11px] text-ink-soft">/ 100</span>
      </div>
    </div>
  );
}
