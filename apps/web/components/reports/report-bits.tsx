"use client";

import type { ReportDto, ReportStatus, ReportType } from "@hera/core";
import { Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import { Pill } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { useCopy } from "@/lib/hooks/compliance";

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  audit: "Compliance audit",
  screening_evidence: "Screening evidence",
  travel_rule: "Travel Rule record",
};

const STATUS: Record<ReportStatus, { label: string; tone: "neutral" | "iris" | "low" | "severe" }> = {
  queued: { label: "Queued", tone: "neutral" },
  rendering: { label: "Rendering", tone: "iris" },
  ready: { label: "Ready", tone: "low" },
  failed: { label: "Failed", tone: "severe" },
};

export const reportPending = (r: Pick<ReportDto, "status">) => r.status === "queued" || r.status === "rendering";

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  return <Pill tone={STATUS[status].tone}>{STATUS[status].label}</Pill>;
}

/** "4be1f0c2…e83d10" */
export const shortHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`;

/** The little document tile: sun when ready, blush-red when failed, paper while pending. */
export function PdfTile({ status, size = "md" }: { status: ReportStatus; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md border-2 border-line font-mono font-medium",
        size === "lg" ? "h-[150px] w-[120px] text-sm shadow-hard" : "h-[54px] w-11 text-[10px]",
        status === "ready" ? "bg-sun text-[#17130F]" : status === "failed" ? "bg-risk-severe-soft" : "bg-paper",
      )}
    >
      PDF
    </span>
  );
}

/** Indeterminate bar for queued/rendering. The status text carries the meaning; motion is decoration. */
export function RenderingBar({ status, label }: { status: ReportStatus; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuetext={status === "queued" ? "Queued" : "Rendering"}
      className="relative h-2.5 w-full max-w-[320px] overflow-hidden rounded-full border-2 border-line bg-paper"
    >
      <motion.div
        className="absolute inset-y-0 left-0 w-2/5 bg-iris"
        initial={{ x: "-100%" }}
        animate={{ x: "250%" }}
        transition={{ duration: status === "queued" ? 2.4 : 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/** Full hash with a copy button, for the report page. */
export function HashRow({ label, value }: { label: string; value?: string }) {
  const { copy, copied } = useCopy();
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      {value ? (
        <div className="flex items-start gap-2 rounded-[10px] border-2 border-line bg-paper px-3 py-2">
          <code className="min-w-0 flex-1 font-mono text-[13px] break-all">{value}</code>
          <button
            type="button"
            onClick={() => copy(value, `${label} copied`)}
            aria-label={`Copy ${label}`}
            className="grid size-8 shrink-0 place-items-center rounded-md text-ink-soft hover:bg-paper-2 hover:text-ink"
          >
            {copied === value ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          </button>
        </div>
      ) : (
        <span className="text-sm text-ink-soft">Available when the report is ready.</span>
      )}
    </div>
  );
}
