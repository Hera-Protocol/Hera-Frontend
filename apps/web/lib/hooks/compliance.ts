"use client";

import type { CreateReportInput, ReportDto } from "@hera/core";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { keys } from "@/lib/queries";

/* ─── Reports ────────────────────────────────────────── */

const isPending = (r?: ReportDto) => r?.status === "queued" || r?.status === "rendering";

/**
 * One report, polled every 3 s while it's queued or rendering. Shares the
 * `useReport` cache key, so the history list and the detail page agree.
 */
export function useReportLive(id: string) {
  return useQuery({
    queryKey: keys.report(id),
    queryFn: () => api.get<ReportDto>(`/reports/${id}`),
    refetchInterval: (query) => (isPending(query.state.data) ? 3_000 : false),
  });
}

/**
 * `ReportDto` doesn't echo the params it was generated from, so remember them
 * in this browser to make "Retry" a single click. Best effort: storage can be
 * unavailable, and then retry falls back to prefilling the form.
 */
const PARAMS_KEY = "hera.report-params";

export function rememberReportParams(id: string, input: CreateReportInput) {
  try {
    const all = JSON.parse(localStorage.getItem(PARAMS_KEY) ?? "{}") as Record<string, CreateReportInput>;
    all[id] = input;
    // Keep the newest 100, matching the API's history length.
    const trimmed = Object.fromEntries(Object.entries(all).slice(-100));
    localStorage.setItem(PARAMS_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage unavailable */
  }
}

export function recallReportParams(id: string): CreateReportInput | null {
  try {
    const all = JSON.parse(localStorage.getItem(PARAMS_KEY) ?? "{}") as Record<string, CreateReportInput>;
    return all[id] ?? null;
  } catch {
    return null;
  }
}

/* ─── Browser helpers ────────────────────────────────── */

/** `location.origin` without a hydration mismatch (empty on the server). */
export function useOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

export const verifyUrl = (origin: string, reference: string) => `${origin}/verify/${reference}`;

/**
 * Start a same-origin download. The API serves PDFs as attachments, so this
 * never navigates away, and it isn't caught by popup blockers after an await.
 */
export function startDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Copy text with a toast, and a short-lived `copied` flag for the button label. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (value: string, label = "Copied") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      toast.success(label);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy. Select it and copy manually.");
    }
  }, []);
  return { copy, copied };
}

/* ─── Unsaved changes ────────────────────────────────── */

/**
 * Ask before leaving with unsaved changes: the native prompt on reload/close,
 * and a confirm() on in-app link clicks (the App Router has no navigation
 * blocker, so link clicks are intercepted in the capture phase before
 * next/link sees them).
 */
export function useUnsavedChangesPrompt(when: boolean, message = "You have unsaved changes. Leave without saving?") {
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need a returnValue.
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when, message]);
}
