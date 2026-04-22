import { useState } from "react";
import { motion } from "framer-motion";

import { BackendNotice } from "@/components/BackendNotice";
import { DashboardLayout } from "@/components/DashboardLayout";
import { formatDisplayId } from "@/lib/hera-api";
import { useActiveWorkspace, useWorkspaceAuditLogsQuery } from "@/lib/hera-hooks";
import { useHeraConfig } from "@/lib/hera-config";

const actionTypes = ["ALL", "CASE_CREATED", "SCAN_STARTED", "REPORT_EXPORTED", "KEY_IMPORT", "STATUS_CHANGED"];

const AuditLog = () => {
  const { isConfigured } = useHeraConfig();
  const { activeWorkspace, activeWorkspaceId, isLoading: isWorkspaceLoading, error: workspaceError } = useActiveWorkspace();
  const auditQuery = useWorkspaceAuditLogsQuery(activeWorkspaceId);
  const [filter, setFilter] = useState("ALL");

  if (!isConfigured) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Backend connection required"
          description="Set your API base URL and bearer API key before loading workspace audit logs."
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
          description="Create a workspace in Settings before trying to inspect audit history."
        />
      </DashboardLayout>
    );
  }

  if (auditQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Loading audit logs...</div>
      </DashboardLayout>
    );
  }

  if (auditQuery.error) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Failed to load audit logs"
          description={auditQuery.error instanceof Error ? auditQuery.error.message : "The API did not return audit log data."}
        />
      </DashboardLayout>
    );
  }

  const entries = auditQuery.data ?? [];
  const filtered =
    filter === "ALL" ? entries : entries.filter((entry) => entry.action === filter);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete activity history for {activeWorkspace.name}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {actionTypes.map((a) => (
            <button
              key={a}
              onClick={() => setFilter(a)}
              className={`px-3 py-1 text-[11px] uppercase tracking-[0.08em] font-medium border transition-colors ${
                filter === a
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="text-left px-4 py-3 label-tag">Timestamp</th>
                <th className="text-left px-4 py-3 label-tag">Actor</th>
                <th className="text-left px-4 py-3 label-tag">Action</th>
                <th className="text-left px-4 py-3 label-tag">Resource</th>
                <th className="text-left px-4 py-3 label-tag">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <motion.tr
                  key={`${entry.timestamp}-${entry.action}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`border-b border-border last:border-0 ${
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.actorId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{entry.action}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {entry.resourceType === "case" ? formatDisplayId(entry.resourceId) : entry.resourceId}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.ipAddr ?? "internal"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditLog;
