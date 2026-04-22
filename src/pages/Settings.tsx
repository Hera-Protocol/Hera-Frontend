import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Copy, Check, Eye, EyeOff, Plus, PlugZap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

import { useCreateWorkspaceMutation, useWorkspacesQuery } from "@/lib/hera-hooks";
import { useHeraConfig } from "@/lib/hera-config";

const Settings = () => {
  const queryClient = useQueryClient();
  const {
    apiBaseUrl,
    apiKey,
    selectedWorkspaceId,
    updateConnection,
    setSelectedWorkspaceId,
    clearConnection,
    isConfigured,
  } = useHeraConfig();
  const workspacesQuery = useWorkspacesQuery();
  const createWorkspaceMutation = useCreateWorkspaceMutation();
  const [draftBaseUrl, setDraftBaseUrl] = useState(apiBaseUrl);
  const [draftApiKey, setDraftApiKey] = useState(apiKey);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const masked = draftApiKey
    ? `${draftApiKey.slice(0, 12)}${"•".repeat(16)}${draftApiKey.slice(-4)}`
    : "Not configured";

  const copyKey = () => {
    if (!draftApiKey) {
      toast("No API key configured");
      return;
    }
    navigator.clipboard.writeText(draftApiKey);
    setCopied(true);
    toast("API key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const saveConnection = async () => {
    updateConnection({ apiBaseUrl: draftBaseUrl, apiKey: draftApiKey });
    await queryClient.invalidateQueries({ queryKey: ["hera"] });
    toast("Backend connection saved");
  };

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
            Manage the live backend connection, API key, and selected workspace.
          </p>
        </div>

        <section className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-mono font-semibold text-sm">Connection</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Stage 1 uses bearer API keys. Save the backend URL and key here.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="label-tag block mb-2">API Base URL</label>
              <input
                type="text"
                value={draftBaseUrl}
                onChange={(e) => setDraftBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:3000"
                className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="label-tag block mb-2">Bearer API Key</label>
              <div className="flex items-center gap-2 bg-muted border border-border px-3 py-2.5">
                <code className="flex-1 text-xs font-mono text-foreground truncate">
                  {revealed ? draftApiKey || "Not configured" : masked}
                </code>
                <button
                  onClick={() => setRevealed((value) => !value)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  title={revealed ? "Hide" : "Reveal"}
                >
                  {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={copyKey}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  title="Copy"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <textarea
                value={draftApiKey}
                onChange={(e) => setDraftApiKey(e.target.value)}
                placeholder="Paste a tenant API key"
                rows={4}
                className="mt-3 w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="flex items-start gap-3 border border-secondary/20 bg-secondary/5 p-3">
              <PlugZap className="w-3.5 h-3.5 text-secondary mt-0.5 shrink-0" />
              <p className="text-xs text-secondary/90 leading-relaxed">
                The backend does not implement user login yet. This frontend authenticates directly with the API key you provide here.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                onClick={clearConnection}
                className="inline-flex items-center gap-2 px-5 py-2 border border-border text-xs uppercase tracking-[0.08em] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
              <button
                onClick={saveConnection}
                className="px-5 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors"
              >
                Save Connection
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
              Load, select, and create tenant workspaces through the Stage 1 API.
            </p>
          </div>
          <div className="p-6 space-y-4">
            {!isConfigured ? (
              <div className="text-sm text-muted-foreground">
                Save a backend connection first to load tenant workspaces.
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

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border border-primary/20 bg-primary/5"
        >
          <div className="px-6 py-4 border-b border-primary/20">
            <h2 className="font-mono font-semibold text-sm text-primary">Stage 1 Scope</h2>
            <p className="text-xs text-muted-foreground mt-1">
              These controls reflect the backend that exists today.
            </p>
          </div>
          <div className="p-6 space-y-2 text-sm text-foreground/90">
            <p>Available now: connect by API key, list/create workspaces, create cases, import viewing keys, scan, view events, download reports, inspect audit logs.</p>
            <p>Not implemented yet: email/password auth, API key rotation, workspace rename, workspace deletion, key deletion.</p>
          </div>
        </motion.section>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
