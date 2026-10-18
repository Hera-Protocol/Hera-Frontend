"use client";

import {
  CHAINS,
  type ChainId,
  decodeMuxedAccount,
  parseSubject,
  type ScreenRequest,
  shortAddress,
  type SubjectRef,
} from "@hera/core";
import { useMemo } from "react";
import { toast } from "sonner";
import { ApiError, errorMessage } from "@/lib/api";
import { reportPdfUrl, useCreateReport } from "@/lib/queries";

/* ─── Greeting ───────────────────────────────────────── */

export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Evening";
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

export function firstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? "";
}

/* ─── Chains ─────────────────────────────────────────── */

export function chainName(chain: string): string {
  return CHAINS[chain]?.name ?? chain;
}

export function explorerTxUrl(chain: string, hash: string): string | undefined {
  return CHAINS[chain]?.explorerTxUrl(hash);
}

export function explorerAddressUrl(chain: string, address: string): string | undefined {
  return CHAINS[chain]?.explorerAddressUrl(address);
}

/* ─── Subjects ───────────────────────────────────────── */

export type MemoType = "id" | "text" | "hash";
/** "detect" lets the address decide (G…/M… → Stellar, 0x… → Ethereum). */
export type ChainChoice = "detect" | ChainId;

export interface SubjectDraft {
  address: string;
  chain: ChainChoice;
  memoType: MemoType;
  memo: string;
}

export type SubjectCheck =
  | { state: "empty" }
  | { state: "error"; message: string; field: "address" | "memo" | "chain" }
  | { state: "ok"; subject: SubjectRef; message: string; sharedHint: boolean };

/** Live, local validation with @hera/core's parser: the same code the API runs. */
export function checkSubject(draft: SubjectDraft): SubjectCheck {
  const address = draft.address.trim();
  if (!address) return { state: "empty" };
  const memoValue = draft.memo.trim();
  const isEvm = /^0x/i.test(address);
  const isStellar = /^[GM]/.test(address);

  if (draft.chain === "stellar" && isEvm) {
    return { state: "error", field: "chain", message: "That's an EVM address. Pick Ethereum, or let Hera detect the chain." };
  }
  if (draft.chain !== "detect" && draft.chain !== "stellar" && isStellar) {
    return { state: "error", field: "chain", message: "That's a Stellar address. Pick Stellar, or let Hera detect the chain." };
  }
  if (isEvm && memoValue) {
    return { state: "error", field: "memo", message: "Memos only apply to Stellar. Remove the memo for an EVM address." };
  }

  const parsed = parseSubject({
    address,
    ...(draft.chain !== "detect" ? { chain: draft.chain } : {}),
    ...(memoValue ? { memo: { type: draft.memoType, value: memoValue } } : {}),
  });
  if (!parsed.ok) {
    const field = /memo/i.test(parsed.error) && !address.startsWith("M") ? "memo" : "address";
    return { state: "error", field, message: parsed.error };
  }

  const subject = parsed.subject;
  if (subject.chain === "stellar") {
    if (subject.sub?.kind === "muxed") {
      return { state: "ok", subject, sharedHint: false, message: `SEP-23: ${shortAddress(subject.account)} + muxed ID ${subject.sub.id}` };
    }
    if (subject.sub?.kind === "memo") {
      return { state: "ok", subject, sharedHint: false, message: `Stellar ${shortAddress(subject.account)} + memo ${subject.sub.type} ${subject.sub.value}` };
    }
    return {
      state: "ok",
      subject,
      sharedHint: true,
      message: `Stellar account ${shortAddress(subject.account)}. If it's a shared exchange or anchor account, add a memo to screen one customer.`,
    };
  }

  const body = address.slice(2);
  const hadChecksum = body !== body.toLowerCase() && body !== body.toUpperCase();
  return {
    state: "ok",
    subject,
    sharedHint: false,
    message: hadChecksum
      ? `EIP-55 checksum OK · ${chainName(subject.chain)}`
      : `Valid ${chainName(subject.chain)} address (no checksum in your input, normalized to ${shortAddress(subject.address)})`,
  };
}

export function useSubjectCheck(draft: SubjectDraft): SubjectCheck {
  const { address, chain, memoType, memo } = draft;
  return useMemo(() => checkSubject({ address, chain, memoType, memo }), [address, chain, memoType, memo]);
}

/** The body for POST /screen from a form draft. */
export function draftToRequest(draft: SubjectDraft): ScreenRequest {
  const memo = draft.memo.trim();
  return {
    address: draft.address.trim(),
    ...(draft.chain !== "detect" ? { chain: draft.chain } : {}),
    ...(memo && !/^0x/i.test(draft.address.trim()) ? { memo: { type: draft.memoType, value: memo } } : {}),
  };
}

/** The body for POST /screen that re-screens a stored subject exactly. */
export function subjectToRequest(subject: SubjectRef): ScreenRequest {
  if (subject.chain !== "stellar") return { address: subject.address, chain: subject.chain };
  if (subject.sub?.kind === "muxed") return { address: subject.sub.muxed, chain: "stellar" };
  if (subject.sub?.kind === "memo") return { address: subject.account, chain: "stellar", memo: { type: subject.sub.type, value: subject.sub.value } };
  return { address: subject.account, chain: "stellar" };
}

/** Base address of a subject, for display. */
export function subjectBase(subject: SubjectRef): string {
  return subject.chain === "stellar" ? subject.account : subject.address;
}

/** "muxed ID 42", "memo id 1001", or "base account". */
export function subLabel(subject: SubjectRef): string {
  if (subject.chain !== "stellar") return "";
  if (subject.sub?.kind === "muxed") return `muxed ID ${subject.sub.id}`;
  if (subject.sub?.kind === "memo") return `memo ${subject.sub.type} ${subject.sub.value}`;
  return "base account";
}

/** Parse a stored display string ("G… (memo id: 42)" or "M…") into base + sub-account caption. */
export function splitDisplay(display: string): { base: string; sub?: string } {
  const memo = /^(\S+) \(memo (\w+): (.+)\)$/.exec(display);
  if (memo) return { base: memo[1]!, sub: `memo ${memo[2]} ${memo[3]}` };
  if (display.startsWith("M")) {
    const muxed = decodeMuxedAccount(display);
    if (muxed) return { base: display, sub: `muxed ID ${muxed.id.toString()}` };
  }
  return { base: display };
}

/* ─── Screening errors ───────────────────────────────── */

export type ScreenErrorKind = "field" | "chain_unavailable" | "chain_not_live" | "other";

export function classifyScreenError(error: unknown): { kind: ScreenErrorKind; message: string; field?: string } {
  if (error instanceof ApiError) {
    if (error.code === "chain_not_live") return { kind: "chain_not_live", message: error.message };
    if (error.status === 502 || error.code === "chain_unavailable") return { kind: "chain_unavailable", message: error.message };
    if (error.status === 422) {
      const [field, message] = Object.entries(error.fields)[0] ?? ["address", error.message];
      return { kind: "field", field, message };
    }
  }
  return { kind: "other", message: errorMessage(error) };
}

/* ─── Evidence export ────────────────────────────────── */

/**
 * Create a screening_evidence report and open its PDF. For a known screening a
 * tab is opened synchronously on click (so popup blockers allow it) and then
 * pointed at the PDF. When the screening is still running (a promise), the
 * finished report is offered as a toast action instead.
 */
export function useEvidenceExport() {
  const create = useCreateReport();
  const exportFor = async (screeningId: string | Promise<string>) => {
    const immediate = typeof screeningId === "string";
    const tab = immediate && typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
    const pending = immediate ? undefined : toast.loading("Screening and building the evidence PDF…");
    try {
      const id = await screeningId;
      const report = await create.mutateAsync({ type: "screening_evidence", screeningId: id });
      if (report.status === "failed") throw new Error(report.error ?? "The report couldn't be rendered.");
      const url = reportPdfUrl(report.id);
      if (tab) {
        tab.location.href = url;
        toast.success(`Evidence report ${report.reference} is ready`);
      } else {
        toast.success(`Evidence report ${report.reference} is ready`, {
          id: pending,
          action: { label: "Open PDF", onClick: () => window.open(url, "_blank", "noopener") },
        });
      }
      return report;
    } catch (e) {
      tab?.close();
      toast.error(errorMessage(e), { id: pending });
      return null;
    }
  };
  return { exportFor, isPending: create.isPending };
}

/* ─── CSV ────────────────────────────────────────────── */

function csvCell(value: unknown): string {
  const s = value === undefined || value === null ? "" : String(value);
  // Neutralize spreadsheet formulas and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Short form of a stored display string: "GA5Z…KZVN · memo id 42". */
export function shortSubject(display: string): string {
  const { base, sub } = splitDisplay(display);
  return sub ? `${shortAddress(base)} · ${sub}` : shortAddress(base);
}

/** Length at which an address is "fully typed", so live errors don't fire mid-paste. */
export function fullAddressLength(address: string): number {
  const a = address.trim();
  return a.startsWith("M") ? 69 : a.startsWith("G") ? 56 : /^0x/i.test(a) ? 42 : 1;
}
