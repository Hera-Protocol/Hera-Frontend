import { DashboardLayout } from "@/components/DashboardLayout";
import { ChainBadge } from "@/components/ChainBadge";
import { motion } from "framer-motion";
import { ShieldAlert, KeyRound, Plus, Eye } from "lucide-react";
import { Link } from "react-router-dom";

import { BackendNotice } from "@/components/BackendNotice";
import { formatDisplayId } from "@/lib/hera-api";
import { useActiveWorkspace, useWorkspaceKeysQuery } from "@/lib/hera-hooks";
import { useHeraConfig } from "@/lib/hera-config";

const Keys = () => {
  const { isConfigured } = useHeraConfig();
  const { activeWorkspace, activeWorkspaceId, isLoading: isWorkspaceLoading, error: workspaceError } = useActiveWorkspace();
  const keysQuery = useWorkspaceKeysQuery(activeWorkspaceId);

  if (!isConfigured) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Sign in required"
          description="Sign in with your username and password before loading encrypted viewing keys."
          actionLabel="Go to Login"
          actionPath="/login"
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
          description="Create a workspace in Settings before trying to inspect viewing keys."
        />
      </DashboardLayout>
    );
  }

  if (keysQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Loading keys...</div>
      </DashboardLayout>
    );
  }

  if (keysQuery.error) {
    return (
      <DashboardLayout>
        <BackendNotice
          title="Failed to load keys"
          description={keysQuery.error instanceof Error ? keysQuery.error.message : "The API did not return key data."}
        />
      </DashboardLayout>
    );
  }

  const keys = keysQuery.data ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Viewing Keys</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Encrypted viewing keys linked to cases in {activeWorkspace.name}
            </p>
          </div>
          <Link
            to="/dashboard/new-case"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium rounded-[6px] hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Import Key
          </Link>
        </div>

        {/* Warning banner */}
          <div className="flex items-start gap-3 p-4 border border-primary/30 bg-primary/5 rounded-[6px]">
          <ShieldAlert className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-foreground/90">
            Viewing keys are encrypted at rest using AES-256 with per-tenant KMS wrapping. This page is currently read-only.
          </div>
        </div>

        {/* Table */}
        {keys.length === 0 ? (
          <div className="border border-border bg-card p-16 text-center rounded-[6px]">
            <KeyRound className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No viewing keys imported yet.</p>
          </div>
        ) : (
          <div className="border border-border bg-card overflow-x-auto rounded-[6px]">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 label-tag">Key Ref</th>
                  <th className="text-left px-4 py-3 label-tag">Chain</th>
                  <th className="text-left px-4 py-3 label-tag">Added</th>
                  <th className="text-left px-4 py-3 label-tag">Birthday</th>
                  <th className="text-right px-4 py-3 label-tag">Case</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k, i) => (
                  <motion.tr
                    key={k.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{k.keyRef}</td>
                    <td className="px-4 py-3"><ChainBadge chain={k.chain} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{new Date(k.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs font-mono">{k.birthdayHeight ?? "None"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/dashboard/case/${k.caseId}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 uppercase tracking-[0.1em]"
                      >
                        <Eye className="w-3 h-3" />
                        {formatDisplayId(k.caseId)}
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

export default Keys;
