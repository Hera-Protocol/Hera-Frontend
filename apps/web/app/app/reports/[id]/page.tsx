"use client";

import { ArrowLeft, Check, Download, ExternalLink, FileJson, Link2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { HashRow, PdfTile, RenderingBar, REPORT_TYPE_LABEL, ReportStatusPill, reportPending } from "@/components/reports/report-bits";
import { Button, buttonStyles, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Skeleton } from "@/components/ui/misc";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useCopy, useOrigin, useReportLive, verifyUrl } from "@/lib/hooks/compliance";
import { reportJsonUrl, reportPdfUrl } from "@/lib/queries";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const report = useReportLive(id);
  const origin = useOrigin();
  const { copy, copied } = useCopy();

  if (report.isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy>
        <Skeleton className="h-12 w-80" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (report.isError) {
    return (
      <Card>
        {report.error instanceof ApiError && report.error.status === 404 ? (
          <EmptyState
            title="Report not found"
            body="It may belong to another organization you're a member of. Switch org from the sidebar, or check the link."
            action={<ButtonLink href="/app/reports">All reports</ButtonLink>}
            mood="alarmed"
          />
        ) : (
          <ErrorBlock error={report.error} onRetry={() => report.refetch()} />
        )}
      </Card>
    );
  }

  const r = report.data;
  const pending = reportPending(r);
  const link = verifyUrl(origin, r.reference);

  return (
    <div className="flex flex-col gap-[22px]">
      <Link href="/app/reports" className="inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All reports
      </Link>
      <PageHeader title={r.title} description={<span className="font-mono text-sm">{r.reference} · {REPORT_TYPE_LABEL[r.type]}</span>} />

      <div className="flex flex-wrap items-start gap-[22px]">
        <section
          aria-label="Document"
          className="flex min-w-0 flex-[1_1_320px] flex-col items-center gap-4 rounded-[18px] border-3 border-line bg-card p-6 text-center shadow-[6px_6px_0_var(--iris)]"
        >
          <PdfTile status={r.status} size="lg" />
          <ReportStatusPill status={r.status} />
          {r.status === "ready" && (
            <>
              <a href={reportPdfUrl(r.id)} download className={buttonStyles({ size: "lg", className: "w-full max-w-[320px]" })}>
                <Download aria-hidden className="size-5" /> Download PDF
              </a>
              <a href={reportJsonUrl(r.id)} target="_blank" rel="noreferrer" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                <FileJson aria-hidden className="size-4" /> JSON snapshot
              </a>
            </>
          )}
          {pending && (
            <div className="flex w-full flex-col items-center gap-2" role="status">
              <RenderingBar status={r.status} label="Report progress" />
              <p className="text-sm text-ink-soft">
                {r.status === "queued" ? "Waiting for the renderer." : "Rendering the PDF."} This page updates by itself, and we&apos;ll email you when it&apos;s
                ready.
              </p>
            </div>
          )}
          {r.status === "failed" && (
            <div className="flex flex-col items-center gap-3">
              <p role="alert" className="text-sm text-risk-severe">
                This report failed{r.error ? `: ${r.error}` : "."}
              </p>
              <ButtonLink href={`/app/reports?type=${r.type}`} variant="secondary" size="sm">
                Generate it again
              </ButtonLink>
            </div>
          )}
          <p className="text-xs text-ink-soft">The PDF downloads as a file; the API doesn&apos;t allow it to be shown inline.</p>
        </section>

        <Card className="min-w-0 flex-[999_1_420px] overflow-hidden">
          <CardHeader title="Details" />
          <div className="flex flex-col gap-5 p-5">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <Row label="Status">
                <ReportStatusPill status={r.status} />
              </Row>
              <Row label="Type">{REPORT_TYPE_LABEL[r.type]}</Row>
              <Row label="Reference">
                <span className="font-mono">{r.reference}</span>
              </Row>
              <Row label="Requested by">{r.requestedBy}</Row>
              <Row label="Created">
                <time dateTime={r.createdAt}>{formatDateTime(r.createdAt)}</time>
              </Row>
              <Row label="Ready">{r.readyAt ? <time dateTime={r.readyAt}>{formatDateTime(r.readyAt)}</time> : "Not yet"}</Row>
            </dl>
            <HashRow label="PDF SHA-256" value={r.pdfSha256} />
            <HashRow label="JSON SHA-256" value={r.jsonSha256} />
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Verify link</span>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-[1_1_200px] rounded-[10px] border-2 border-line bg-paper px-3 py-2 font-mono text-[13px] break-all">
                  {origin ? link : `/verify/${r.reference}`}
                </code>
                <Button variant="secondary" size="sm" onClick={() => copy(link, "Verify link copied")} disabled={!origin}>
                  {copied === link ? <Check aria-hidden className="size-4" /> : <Link2 aria-hidden className="size-4" />} Copy
                </Button>
                <a href={`/verify/${r.reference}`} target="_blank" rel="noreferrer" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                  Open <ExternalLink aria-hidden className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-xl font-extrabold">How anyone can verify this</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed">
          <li>Every page of the PDF prints its reference, the JSON SHA-256 and the verify link in the footer.</li>
          <li>
            Whoever holds a copy opens the verify page and drops in the PDF, or pastes a hash. The file is hashed in their browser; only the hash
            is sent.
          </li>
          <li>Hera says whether it matches a report it issued, and shows the reference, type, issuing org and date. Never the contents.</li>
          <li>If one byte changed, the hash won&apos;t match. The JSON snapshot hashes to the JSON SHA-256 above, for machine checks.</li>
        </ol>
      </Card>
    </div>
  );
}
