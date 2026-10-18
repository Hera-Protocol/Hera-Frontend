"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

const TONES = {
  low: "text-risk-low border-risk-low bg-risk-low-soft",
  medium: "text-risk-medium border-risk-medium bg-risk-medium-soft",
  high: "text-risk-high border-risk-high bg-risk-high-soft",
  severe: "text-risk-severe border-risk-severe bg-risk-severe-soft",
} as const;

/** Rubber-stamp verdict that slams in. */
export function Stamp({ tone, children, className, rotate = -8 }: { tone: keyof typeof TONES; children: React.ReactNode; className?: string; rotate?: number }) {
  return (
    <motion.span
      initial={{ scale: 2.2, rotate: rotate - 6, opacity: 0 }}
      animate={{ scale: 1, rotate, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.15 }}
      className={cn("inline-block rounded-[10px] border-4 px-3 py-0.5 font-display text-[22px] font-extrabold tracking-[0.08em]", TONES[tone], className)}
    >
      {children}
    </motion.span>
  );
}
