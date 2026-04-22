import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Clock, Eye, FileText, FolderOpen } from "lucide-react";

import { BackendNotice } from "@/components/BackendNotice";
import { ChainBadge } from "@/components/ChainBadge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusPill } from "@/components/StatusPill";
import { formatDisplayId } from "@/lib/hera-api";
import { useActiveWorkspace, useWorkspaceCasesQuery, useWorkspaceReportsQuery } from "@/lib/hera-hooks";
import { useHeraConfig } from "@/lib/hera-config";

const Dashboard = () => {
  const { isConfigured } = useHeraConfig();
  const { activeWorkspace, activeWorkspaceId, isLoading: isWorkspaceLoading, error: workspaceError } = useActiveWorkspace();
  const casesQuery = useWorkspaceCasesQuery(activeWorkspaceId);
  const reportsQuery = useWorkspaceReportsQuery(activeWorkspaceId);

  if (!isConfigured) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Backend connection required"
          description="Set your Stage 1 API base URL and bearer API key before the dashboard can load live workspace data."
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
          description={workspaceError instanceof Error ? workspaceError.message : "The API did not return a workspace list."}
        />
      </DashboardLayout>
    );
  }

  if (!activeWorkspace) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="No workspace found"
          description="This API key is valid, but no workspaces exist for it yet. Create one in Settings before starting a case."
        />
      </DashboardLayout>
    );
  }

  if (casesQuery.isLoading || reportsQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Loading compliance overview...</div>
      </DashboardLayout>
    );
  }

  if (casesQuery.error || reportsQuery.error) {
    const message =
      (casesQuery.error instanceof Error && casesQuery.error.message) ||
      (reportsQuery.error instanceof Error && reportsQuery.error.message) ||
      "Failed to load dashboard data.";

    return (
      <DashboardLayout>
        <BackendNotice title="Dashboard unavailable" description={message} />
      </DashboardLayout>
    );
  }

  const cases = casesQuery.data ?? [];
  const reports = reportsQuery.data ?? [];
  const recentCases = cases.slice(0, 5);
  const lastUpdatedCase = [...cases].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  )[0];
  const stats = [
    {
      label: "Active Cases",
      value: cases.filter((caseItem) => caseItem.status === "CREATED" || caseItem.status === "SCANNING").length.toString(),
      icon: FolderOpen,
    },
    {
      label: "Reports Generated",
      value: reports.length.toString(),
      icon: FileText,
    },
    {
      label: "Last Scan",
      value: lastUpdatedCase
        ? formatDistanceToNow(new Date(lastUpdatedCase.updatedAt), { addSuffix: true })
        : "No scans yet",
      icon: Clock,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-mono font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compliance overview for {activeWorkspace.name}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="border border-border bg-card p-5 rounded-[6px]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="label-tag">{stat.label}</span>
                <stat.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-mono font-bold">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div>
          <h2 className="text-sm font-mono font-semibold mb-4 uppercase tracking-wider text-muted-foreground">
            Recent Cases
          </h2>
          {recentCases.length === 0 ? (
            <BackendNotice
              title="No cases yet"
              description="Your workspace is connected. Start a new case to begin importing viewing keys and generating reports."
              actionLabel="Create Case"
              actionPath="/dashboard/new-case"
            />
          ) : (
            <div className="border border-border bg-card overflow-hidden rounded-[6px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 label-tag">Case ID</th>
                    <th className="text-left px-4 py-3 label-tag">Chain</th>
                    <th className="text-left px-4 py-3 label-tag">Status</th>
                    <th className="text-left px-4 py-3 label-tag">Created</th>
                    <th className="text-left px-4 py-3 label-tag">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((caseItem, index) => (
                    <motion.tr
                      key={caseItem.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.06 }}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {formatDisplayId(caseItem.id)}
                      </td>
                      <td className="px-4 py-3">
                        <ChainBadge chain={caseItem.chain} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={caseItem.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(caseItem.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/case/${caseItem.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 uppercase tracking-wider"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
