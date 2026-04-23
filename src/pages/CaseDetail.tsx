import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Download, Lock, Check } from "lucide-react";
import { toast } from "sonner";

import { BackendNotice } from "@/components/BackendNotice";
import { ChainBadge } from "@/components/ChainBadge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScanProgress } from "@/components/ScanProgress";
import { StatusPill } from "@/components/StatusPill";
import { formatDisplayId, heraApi, type UiScanStage, type TimelineEvent } from "@/lib/hera-api";
import { useActiveWorkspace, useCaseDetailQuery, useCaseEventsQuery, useWorkspaceReportsQuery } from "@/lib/hera-hooks";
import { useHeraConfig } from "@/lib/hera-config";

const eventColors: Record<TimelineEvent["eventType"], string> = {
  RECEIVE: "bg-primary/15 text-primary",
  SEND: "bg-secondary/15 text-secondary",
  SHIELD: "bg-zcash/15 text-zcash",
  UNSHIELD: "bg-destructive/15 text-destructive",
  FEE: "bg-muted text-muted-foreground",
};

const CaseDetail = () => {
  const { caseId } = useParams();
  const { apiBaseUrl, apiKey, isConfigured } = useHeraConfig();
  const { activeWorkspaceId } = useActiveWorkspace();
  const caseDetailQuery = useCaseDetailQuery(caseId ?? "");
  const eventsQuery = useCaseEventsQuery(caseId ?? "");
  const reportsQuery = useWorkspaceReportsQuery(activeWorkspaceId);
  const [copied, setCopied] = useState(false);
  const [downloadedHash, setDownloadedHash] = useState<string | null>(null);

  const caseData = caseDetailQuery.data;
  const progressStage: UiScanStage = !caseData
    ? "CREATED"
    : caseData.scanStage === "FAILED"
    ? "BUILDING_REPORT"
    : caseData.scanStage;
  const reportSummary =
    (reportsQuery.data ?? []).find((report) => report.caseId === caseId) ?? null;
  const reportHash = reportSummary?.pdfSha256 ?? downloadedHash;

  const copyHash = () => {
    if (!reportHash) {
      toast("No report hash available yet");
      return;
    }
    navigator.clipboard.writeText(reportHash);
    setCopied(true);
    toast("Report hash copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = async (format: "json" | "pdf") => {
    if (!caseId) return;

    try {
      const artifact = await heraApi.downloadReport(
        { apiBaseUrl, apiKey },
        caseId,
        format
      );
      const url = window.URL.createObjectURL(artifact.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${formatDisplayId(caseId)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloadedHash(artifact.sha256);
      toast(`${format.toUpperCase()} report downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download report");
    }
  };

  if (!isConfigured) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Sign in required"
          description="Sign in with your username and password before loading case detail."
          actionLabel="Go to Login"
          actionPath="/login"
        />
      </DashboardLayout>
    );
  }

  if (!caseId) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Missing case id"
          description="The current route does not include a valid case identifier."
        />
      </DashboardLayout>
    );
  }

  if (caseDetailQuery.isLoading || eventsQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Loading case detail...</div>
      </DashboardLayout>
    );
  }

  if (caseDetailQuery.error || eventsQuery.error) {
    const message =
      (caseDetailQuery.error instanceof Error && caseDetailQuery.error.message) ||
      (eventsQuery.error instanceof Error && eventsQuery.error.message) ||
      "Failed to load case detail.";

    return (
      <DashboardLayout>
        <BackendNotice title="Case unavailable" description={message} />
      </DashboardLayout>
    );
  }

  if (!caseData) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Case not found"
          description="The API did not return a case for this identifier."
        />
      </DashboardLayout>
    );
  }

  const events = eventsQuery.data ?? [];
  const isSigned = caseData.status === "SIGNED";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold">{formatDisplayId(caseData.id)}</h1>
            <button
              onClick={() => {
                navigator.clipboard.writeText(caseData.id);
                toast("Case ID copied");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <ChainBadge chain={caseData.chain} />
          <StatusPill status={caseData.status} />
          {caseData.failureReason ? (
            <span className="text-xs text-destructive font-mono">
              {caseData.failureReason}
            </span>
          ) : null}
        </div>

        <div className="border border-border bg-card p-6">
          <p className="label-tag mb-2">Scan Progress</p>
          <ScanProgress currentStage={progressStage} />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono text-muted-foreground">
            <div>Network: <span className="text-foreground">{caseData.network}</span></div>
            <div>Checkpoint: <span className="text-foreground">{caseData.lastCheckpoint ?? "None"}</span></div>
            <div>Updated: <span className="text-foreground">{new Date(caseData.updatedAt).toLocaleString()}</span></div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-mono font-semibold mb-4 uppercase tracking-wider text-muted-foreground">
            Event Timeline
          </h2>
          {events.length === 0 ? (
            <BackendNotice
              title="No events detected yet"
              description="The scan has not produced canonical events yet, or the viewing key does not expose any matching shielded activity."
              actionLabel="Refresh Case"
              actionPath={`/dashboard/case/${caseId}`}
            />
          ) : (
            <div className="border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 label-tag">Block</th>
                    <th className="text-left px-4 py-3 label-tag">Timestamp</th>
                    <th className="text-left px-4 py-3 label-tag">Type</th>
                    <th className="text-left px-4 py-3 label-tag">Asset</th>
                    <th className="text-right px-4 py-3 label-tag">Amount</th>
                    <th className="text-left px-4 py-3 label-tag">Proof</th>
                    <th className="text-left px-4 py-3 label-tag">Counterparty</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, index) => (
                    <motion.tr
                      key={event.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{event.blockHeight}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${eventColors[event.eventType]}`}>
                          {event.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{event.asset}</td>
                      <td className="px-4 py-3 font-mono text-xs text-right">{event.amount}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary font-medium">
                          {event.ownershipProof}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {event.counterpartyVisibility === "UNKNOWN" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="w-3 h-3" />
                            Unknown
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {event.counterpartyValue ?? event.counterpartyVisibility}
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isSigned && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-primary/20 bg-primary/5 p-6 space-y-4"
          >
            <p className="label-tag text-primary">Report Ready</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => downloadReport("json")}
                className="inline-flex items-center gap-2 px-5 py-2 border border-primary text-primary text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/10 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download JSON Report
              </button>
              <button
                onClick={() => downloadReport("pdf")}
                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF Report
              </button>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs font-mono text-muted-foreground truncate max-w-md">
                {reportHash ?? "Download a report to capture the current artifact hash"}
              </span>
              <button onClick={copyHash} className="text-muted-foreground hover:text-foreground shrink-0">
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CaseDetail;
