"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Modal dialog: focus moves in on open and back on close, Escape closes,
 * and the backdrop click closes. Content behind is inert while open.
 */
export function Dialog({
  open,
  onClose,
  title,
  tone = "paper",
  children,
  className,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  tone?: "paper" | "low";
  children: React.ReactNode;
  className?: string;
  /** false: no close button, and Escape / backdrop clicks are ignored (e.g. a secret shown once). */
  dismissible?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Portals can't render on the server; wait for the client to mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissible && onClose();
    document.addEventListener("keydown", onKey);
    const main = document.getElementById("app-root");
    main?.setAttribute("inert", "");
    queueMicrotask(() => panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      main?.removeAttribute("inert");
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#17130F]/45 px-4 py-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className={cn("w-full max-w-[560px] overflow-hidden rounded-[20px] border-2 border-line bg-card shadow-hard-lg", className)}
          >
            <div className={cn("flex items-center justify-between gap-3 border-b-2 border-line px-5 py-4", tone === "low" ? "bg-risk-low-soft" : "bg-paper-2")}>
              <h2 id={titleId} className="text-2xl font-extrabold">
                {title}
              </h2>
              {dismissible && (
              <button
                type="button"
                data-close
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-[10px] border-2 border-line bg-card"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              )}
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
