"use client";

import { shortAddress } from "@hera/core";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { Argus, type ArgusMood } from "../brand/argus";

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[40px] leading-none font-extrabold">{title}</h1>
        {description && <p className="text-base text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action, mood = "idle" }: { title: string; body?: ReactNode; action?: ReactNode; mood?: ArgusMood }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Argus mood={mood} size={120} title="Argus the peacock" />
      <h3 className="text-2xl font-extrabold">{title}</h3>
      {body && <p className="max-w-md text-[15px] text-ink-soft">{body}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[10px] bg-ink/10", className)} aria-hidden />;
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="m-5 flex flex-wrap items-center gap-3 rounded-[12px] border-2 border-line bg-risk-severe-soft p-4 text-sm">
      <strong className="text-risk-severe">Couldn't load this.</strong>
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-auto rounded-[10px] border-2 border-line bg-card px-3 py-1 font-bold">
          Try again
        </button>
      )}
    </div>
  );
}

/** Mono address with a copy button. */
export function Address({ value, full = false, className }: { value: string; full?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select it and copy manually.");
    }
  };
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 font-mono text-sm", className)}>
      <span className={cn(full ? "break-all" : "truncate")} title={value}>
        {full ? value : shortAddress(value, 4, 4)}
      </span>
      <button type="button" onClick={copy} aria-label={`Copy ${value}`} className="shrink-0 rounded-md p-1 text-ink-soft hover:bg-paper-2 hover:text-ink">
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
        )}
      </button>
    </span>
  );
}

/** Segmented control (single choice): a radiogroup with roving focus and arrow-key selection. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const current = options.findIndex((o) => o.value === value);
    let next: number | null = null;
    if (e.key in keys) next = (current + keys[e.key]! + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(options[next]!.value);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="flex overflow-hidden rounded-[11px] border-2 border-line bg-card text-sm font-bold">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn("min-h-10 px-3.5", i > 0 && "border-l-2 border-line", on ? "bg-ink text-paper" : "hover:bg-paper-2")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-4 py-2", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <span>
        <strong className="block text-[15px]">{label}</strong>
        {description && <span className="text-sm text-ink-soft">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full border-2 border-line bg-card transition-colors peer-checked:bg-peacock peer-focus-visible:outline-3 peer-focus-visible:outline-iris" />
        <span className="absolute top-1 left-1 size-5 rounded-full border-2 border-line bg-card transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Table inside a card; children are <thead>/<tbody>. Scrolls horizontally on small screens. */
export function DataTable({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    // relative: keeps absolutely positioned sr-only labels inside the scroll box, so they can't widen the page.
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-dashed [&_tbody_tr]:border-line/25 [&_tbody_tr:hover]:bg-paper [&_td]:px-3 [&_td]:py-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-mono [&_th]:text-[11px] [&_th]:font-medium [&_th]:tracking-[0.1em] [&_th]:text-ink-soft [&_th]:uppercase [&_th:first-child]:pl-5 [&_th:last-child]:pr-5 [&_thead]:border-b-2 [&_thead]:border-line" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
