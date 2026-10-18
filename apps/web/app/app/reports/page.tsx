"use client";

import { REPORT_TYPES, type ReportDto, type ReportType } from "@hera/core";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { GenerateReport, type GenerateValues } from "@/components/reports/generate-report";
import { ReportRow } from "@/components/reports/report-row";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api";
import { recallReportParams, useOrigin } from "@/lib/hooks/compliance";
import { useCreateReport, useReports } from "@/lib/queries";

/** `?type=screening_evidence&screeningId=…` or `?type=travel_rule&transferId=…` preselects the generate form. */
function usePrefillFromUrl(): Partial<GenerateValues> | undefined {
  const params = useSearchParams();
  const type = params.get("type") as ReportType | null;
  if (!type || !(REPORT_TYPES as readonly string[]).includes(type)) return undefined;
  return { type, screeningId: params.get("screeningId") ?? "", transferId: params.get("transferId") ?? "" };
}

function ReportsContent() {
  const origin = useOrigin();
  const reports = useReports();
  const retry = useCreateReport();
  const urlPrefill = usePrefillFromUrl();
  const [prefill, setPrefill] = useState<{ values: Partial<GenerateValues>; nonce: number } | null>(() =>
    urlPrefill ? { values: urlPrefill, nonce: 0 } : null,
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const generateRef = useRef<HTMLElement>(null);

  const onRetry = async (report: ReportDto) => {
    const params = recallReportParams(report.id);
    if (!params) {
      // ReportDto doesn't carry its params; fall back to the form.
      setPrefill({ values: { type: report.type }, nonce: Date.now() });
      generateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      generateRef.current?.focus({ preventScroll: true });
      toast.info("Pick the details again, then generate.");
      return;
    }
    setRetryingId(report.id);
    try {
      const next = await retry.mutateAsync(params);
      toast.success(next.status === "ready" ? `${next.reference} is ready` : "Queued again", {
        description: next.status === "ready" ? undefined : "We'll email you when it's ready.",
      });
    } catch (error) {
      toast.error("Couldn't retry", { description: errorMessage(error) });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title="Reports"
        description={`Signed, regulator-ready PDFs. Anyone holding one can check it's genuine at ${origin ? `${new URL(origin).host}/verify` : "the verify page"}.`}
      />

      <GenerateReport ref={generateRef} prefill={prefill} />

      <Card className="overflow-hidden">
        <CardHeader title="History" />
        {reports.isPending ? (
          <LoadingBlock rows={4} />
        ) : reports.isError ? (
          <ErrorBlock error={reports.error} onRetry={() => reports.refetch()} />
        ) : reports.data.length === 0 ? (
          <EmptyState
            title="No reports yet"
            body="Generate an audit report for a period, or an evidence PDF for a screening. Every report gets a reference and a SHA-256 anyone can verify."
          />
        ) : (
          <ul aria-label="Report history">
            {reports.data.map((r) => (
              <ReportRow key={r.id} report={r} onRetry={onRetry} retrying={retryingId === r.id} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <ReportsContent />
    </Suspense>
  );
}
