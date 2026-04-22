import { useState } from "react";
import { motion } from "framer-motion";
import { Download, FileJson, FileX } from "lucide-react";
import { toast } from "sonner";

import { BackendNotice } from "@/components/BackendNotice";
import { ChainBadge } from "@/components/ChainBadge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { formatDisplayId, heraApi, type UiChain } from "@/lib/hera-api";
import { useActiveWorkspace, useWorkspaceReportsQuery } from "@/lib/hera-hooks";
import { useHeraConfig } from "@/lib/hera-config";

const filters = ["ALL", "Zcash", "Namada"] as const;
type Filter = typeof filters[number];

const Reports = () => {
  const { isConfigured, apiBaseUrl, apiKey } = useHeraConfig();
  const { activeWorkspace, activeWorkspaceId, isLoading: isWorkspaceLoading, error: workspaceError } = useActiveWorkspace();
  const reportsQuery = useWorkspaceReportsQuery(activeWorkspaceId);
  const [filter, setFilter] = useState<Filter>("ALL");

  const handleDownload = async (caseId: string, type: "JSON" | "PDF") => {
    try {
      const artifact = await heraApi.downloadReport(
        { apiBaseUrl, apiKey },
        caseId,
        type.toLowerCase() as "json" | "pdf"
      );
      const url = window.URL.createObjectURL(artifact.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${formatDisplayId(caseId)}.${type.toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast(`${type} report downloaded${artifact.sha256 ? ` • ${artifact.sha256}` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to download ${type} report`);
    }
  };

  if (!isConfigured) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Backend connection required"
          description="Set your API base URL and bearer API key before loading signed reports."
        />
      </DashboardLayout>
    );
  }

  if (isWorkspaceLoading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Loading workspace...</div>
      </DashboardLayout>
    );
  }

  if (workspaceError) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Failed to load workspace"
          description={workspaceError instanceof Error ? workspaceError.message : "The API did not return a workspace."}
        />
      </DashboardLayout>
    );
  }

  if (!activeWorkspace) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="No workspace found"
          description="Create a workspace in Settings before trying to load report artifacts."
        />
      </DashboardLayout>
    );
  }

  if (reportsQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Loading reports...</div>
      </DashboardLayout>
    );
  }

  if (reportsQuery.error) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Failed to load reports"
          description={reportsQuery.error instanceof Error ? reportsQuery.error.message : "The API did not return report data."}
        />
      </DashboardLayout>
    );
  }

  const reports = reportsQuery.data ?? [];
  const signed = reports.filter((report) => report.status === "SIGNED");
  const filtered =
    filter === "ALL"
      ? signed
      : signed.filter((report) => report.chain === (filter as UiChain));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Signed compliance reports ready for audit in {activeWorkspace.name}
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] font-medium border rounded-[6px] transition-colors ${
                filter === f
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="border border-border bg-card p-16 text-center rounded-[6px]">
            <FileX className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No signed reports yet. Complete a case scan to generate one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c, i) => (
              <motion.div
                key={c.caseId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="border border-border bg-card p-5 rounded-[6px] hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-2">
                    <p className="font-mono text-xs">{formatDisplayId(c.caseId)}</p>
                    <ChainBadge chain={c.chain} />
                  </div>
                  <span className="label-tag text-success">Signed</span>
                </div>

                <div className="space-y-1 mb-4 text-xs font-mono text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Network</span>
                    <span className="text-foreground">{c.network}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stored</span>
                    <span className="text-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-border">
                  <button
                    onClick={() => handleDownload(c.caseId, "JSON")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border text-xs uppercase tracking-[0.08em] font-medium rounded-[6px] hover:border-primary hover:text-primary transition-colors"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    JSON
                  </button>
                  <button
                    onClick={() => handleDownload(c.caseId, "PDF")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium rounded-[6px] hover:bg-primary/90 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
