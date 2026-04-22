import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Plus, Eye, Lock } from "lucide-react";

import { BackendNotice } from "@/components/BackendNotice";
import { ChainBadge } from "@/components/ChainBadge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusPill } from "@/components/StatusPill";
import { formatDisplayId } from "@/lib/hera-api";
import { useActiveWorkspace, useWorkspaceCasesQuery } from "@/lib/hera-hooks";
import { useHeraConfig } from "@/lib/hera-config";

const filters = ["ALL", "ACTIVE", "SIGNED", "FAILED"] as const;
type Filter = typeof filters[number];

const Cases = () => {
  const { isConfigured } = useHeraConfig();
  const { activeWorkspace, activeWorkspaceId, isLoading: isWorkspaceLoading, error: workspaceError } = useActiveWorkspace();
  const casesQuery = useWorkspaceCasesQuery(activeWorkspaceId);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  if (!isConfigured) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Backend connection required"
          description="Set your API base URL and bearer API key before loading live case data."
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
          description="Create a workspace in Settings before trying to load cases."
        />
      </DashboardLayout>
    );
  }

  if (casesQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Loading cases...</div>
      </DashboardLayout>
    );
  }

  if (casesQuery.error) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Failed to load cases"
          description={casesQuery.error instanceof Error ? casesQuery.error.message : "The API did not return case data."}
        />
      </DashboardLayout>
    );
  }

  const cases = casesQuery.data ?? [];
  const filtered = cases.filter((c) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      c.id.toLowerCase().includes(normalizedQuery) ||
      formatDisplayId(c.id).toLowerCase().includes(normalizedQuery);
    const matchesFilter =
      filter === "ALL" ||
      (filter === "ACTIVE" && (c.status === "CREATED" || c.status === "SCANNING")) ||
      (filter === "SIGNED" && c.status === "SIGNED") ||
      (filter === "FAILED" && c.status === "FAILED");
    return matchesQuery && matchesFilter;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Cases</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All compliance cases in {activeWorkspace.name}
            </p>
          </div>
          <Link
            to="/dashboard/new-case"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium rounded-[6px] hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Case
          </Link>
        </div>

        {/* Search + filter tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search case ID..."
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-[6px] text-sm font-mono focus:outline-none focus:border-primary transition-colors"
            />
          </div>
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
        </div>

        {/* Table or empty */}
        {filtered.length === 0 ? (
          <div className="border border-border bg-card p-16 text-center rounded-[6px]">
            <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-6">No compliance cases match your filters.</p>
            <Link
              to="/dashboard/new-case"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium rounded-[6px] hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Start Your First Scan
            </Link>
          </div>
        ) : (
          <div className="border border-border bg-card overflow-x-auto rounded-[6px]">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 label-tag">Case ID</th>
                  <th className="text-left px-4 py-3 label-tag">Chain</th>
                  <th className="text-left px-4 py-3 label-tag">Status</th>
                  <th className="text-left px-4 py-3 label-tag">Network</th>
                  <th className="text-left px-4 py-3 label-tag">Created</th>
                  <th className="text-left px-4 py-3 label-tag">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{formatDisplayId(c.id)}</td>
                    <td className="px-4 py-3"><ChainBadge chain={c.chain} /></td>
                    <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{c.network}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{new Date(c.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/case/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 uppercase tracking-[0.1em]"
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
    </DashboardLayout>
  );
};

export default Cases;
