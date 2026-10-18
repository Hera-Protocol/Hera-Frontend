"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

/** Copies `value`; the icon flips to a check for a moment. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-[10px] border-2 border-transparent text-ink-soft transition-colors hover:border-line/40 hover:text-ink",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? "check" : "copy"}
          initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={cn("grid place-items-center", copied && "text-peacock")}
        >
          {copied ? <Check className="size-[18px]" strokeWidth={3} aria-hidden /> : <Copy className="size-[18px]" aria-hidden />}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
