import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { useCreateWorkspaceMutation, useWorkspacesQuery } from "@/lib/hera-hooks";
import { useHeraConfig } from "@/lib/hera-config";

const Settings = () => {
  const navigate = useNavigate();
  const {
    username,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    clearConnection,
    isConfigured,
  } = useHeraConfig();
  const workspacesQuery = useWorkspacesQuery();
  const createWorkspaceMutation = useCreateWorkspaceMutation();
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error("Workspace name is required.");
      return;
    }

    try {
      const workspace = await createWorkspaceMutation.mutateAsync({
        name: newWorkspaceName.trim(),
      });
      setSelectedWorkspaceId(workspace.id);
      setNewWorkspaceName("");
      toast.success(`Workspace created: ${workspace.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create workspace.");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-mono font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account session and switch between workspaces.
          </p>
        </div>

        <section className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-mono font-semibold text-sm">Account</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Your beta access is active in this browser session.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 border border-secondary/20 bg-secondary/5 p-3">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary mt-0.5 shrink-0" />
              <p className="text-xs text-secondary/90 leading-relaxed">
                Signed in as <span className="font-mono text-foreground">{username || "beta user"}</span>. Workspace credentials are managed behind the scenes for this beta.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                onClick={() => {
                  clearConnection();
                  navigate("/login", { replace: true });
                }}
                className="inline-flex items-center gap-2 px-5 py-2 border border-border text-xs uppercase tracking-[0.08em] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border border-border bg-card"
        >
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-mono font-semibold text-sm">Workspace</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Load, switch, and create workspaces for your team.
            </p>
          </div>
          <div className="p-6 space-y-4">
            {!isConfigured ? (
              <div className="text-sm text-muted-foreground">
                Sign in first to load available workspaces.
              </div>
            ) : workspacesQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading workspaces...</div>
            ) : workspacesQuery.error ? (
              <div className="text-sm text-destructive">
                {workspacesQuery.error instanceof Error
                  ? workspacesQuery.error.message
                  : "Failed to load workspaces."}
              </div>
            ) : (
              <>
                <div>
                  <label className="label-tag block mb-2">Selected Workspace</label>
                  <select
                    value={selectedWorkspaceId}
                    onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                    className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Choose a workspace</option>
                    {(workspacesQuery.data ?? []).map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="New workspace name"
                    className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={createWorkspace}
                    disabled={createWorkspaceMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {createWorkspaceMutation.isPending ? "Creating..." : "Create"}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.section>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
