import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { highlight } from "./highlight";

const SHADOWS = {
  iris: "shadow-[8px_8px_0_var(--iris)]",
  peacock: "shadow-[6px_6px_0_var(--peacock)]",
  blush: "shadow-[5px_5px_0_var(--blush)]",
  ink: "shadow-hard",
  none: "",
} as const;

/**
 * Outline + colored hard shadow, with a dark surface inside. The inner
 * `data-theme="dark"` scopes the dark tokens, so code reads as a terminal in
 * both themes while the shadow keeps the page's own palette.
 */
export function CodeFrame({ shadow = "iris", className, children }: { shadow?: keyof typeof SHADOWS; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-[18px] border-2 border-line", SHADOWS[shadow], className)}>
      <div data-theme="dark" className="h-full bg-paper text-ink">
        {children}
      </div>
    </div>
  );
}

export function WindowDots() {
  return (
    <span className="flex shrink-0 gap-2" aria-hidden>
      <span className="size-3 rounded-full bg-blush" />
      <span className="size-3 rounded-full bg-sun" />
      <span className="size-3 rounded-full bg-peacock" />
    </span>
  );
}

export function CodeBody({ code, label, className }: { code: string; label: string; className?: string }) {
  return (
    // Focusable so keyboard users can scroll long lines.
    <pre
      tabIndex={0}
      aria-label={label}
      className={cn("overflow-x-auto px-5 py-5 font-mono text-[13px] leading-[1.75] text-ink sm:px-6 sm:text-sm", className)}
    >
      <code>{highlight(code)}</code>
    </pre>
  );
}

/** A complete single-file code window. */
export function CodeWindow({
  filename,
  code,
  shadow,
  actions,
  className,
}: {
  filename: string;
  code: string;
  shadow?: keyof typeof SHADOWS;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <CodeFrame shadow={shadow} className={className}>
      <div className="flex items-center gap-3 border-b border-line/20 px-4 py-3">
        <WindowDots />
        <span className="min-w-0 truncate font-mono text-xs text-ink-soft">{filename}</span>
        {actions && <span className="ml-auto">{actions}</span>}
      </div>
      <CodeBody code={code} label={`Code sample: ${filename}`} />
    </CodeFrame>
  );
}
