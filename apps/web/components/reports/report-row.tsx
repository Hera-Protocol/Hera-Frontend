"use client";

import type { ReportDto } from "@hera/core";
import { Check, Download, FileJson, Link2, RotateCw } from "lucide-react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui/button";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useCopy, useOrigin, verifyUrl } from "@/lib/hooks/compliance";
import { reportJsonUrl, reportPdfUrl } from "@/lib/queries";
import { PdfTile, RenderingBar, REPORT_TYPE_LABEL, ReportStatusPill, reportPending, shortHash } from "./report-bits";

export function ReportRow({ report, onRetry, retrying }: { report: ReportDto; onRetry: (r: ReportDto) => void; retrying?: boolean }) {
  const origin = useOrigin();
  const { copy, copied } = useCopy();
  const pending = reportPending(report);
  const hash = report.pdfSha256 ?? report.jsonSha256;
  const link = verifyUrl(origin, report.reference);

  return (
    <li className="flex flex-wrap items-center gap-4 border-b border-dashed border-line/30 px-5 py-4 last:border-b-0">
      <PdfTile status={report.status} />
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
        <Link href={`/app/reports/${report.id}`} className="text-base font-bold break-words underline-offset-2 hover:underline">
          {report.title}
        </Link>
        <span className="font-mono text-xs break-all text-ink-soft">
          {report.reference}
          {pending ? ` · ${report.status}` : hash ? ` · sha256 ${shortHash(hash)}` : ""}
          {` · ${REPORT_TYPE_LABEL[report.type].toLowerCase()} · by ${report.requestedBy} · `}
          <time dateTime={report.createdAt} title={formatDateTime(report.createdAt)}>
            {timeAgo(report.createdAt)}
          </time>
        </span>
        {pending && <RenderingBar status={report.status} label={`${report.reference} progress`} />}
        {report.status === "failed" && (
          <span className="text-[13px] text-risk-severe">Failed{report.error ? `: ${report.error}` : "."} Generate it again.</span>
        )}
      </div>

      {report.status === "ready" ? (
        <div className="flex flex-wrap gap-2">
          <a href={reportPdfUrl(report.id)} download className={buttonStyles({ size: "sm" })}>
            <Download aria-hidden className="size-4" /> Download PDF
          </a>
          <a
            href={reportJsonUrl(report.id)}
            target="_blank"
            rel="noreferrer"
            className={buttonStyles({ variant: "secondary", size: "sm", className: "shadow-none" })}
            aria-label={`JSON snapshot for ${report.reference}`}
          >
            <FileJson aria-hidden className="size-4" /> JSON
          </a>
          <Button
            variant="secondary"
            size="sm"
            className="shadow-none"
            onClick={() => copy(link, "Verify link copied")}
            disabled={!origin}
            aria-label={`Copy verify link for ${report.reference}`}
          >
            {copied === link ? <Check aria-hidden className="size-4" /> : <Link2 aria-hidden className="size-4" />} Copy verify link
          </Button>
        </div>
      ) : report.status === "failed" ? (
        <div className="flex flex-wrap items-center gap-2">
          <ReportStatusPill status={report.status} />
          <Button variant="secondary" size="sm" onClick={() => onRetry(report)} loading={retrying}>
            <RotateCw aria-hidden className="size-4" /> Retry
          </Button>
        </div>
      ) : (
        <ReportStatusPill status={report.status} />
      )}
    </li>
  );
}
