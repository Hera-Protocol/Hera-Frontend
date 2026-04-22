import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Copy, RefreshCw, AlertTriangle, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const INITIAL_KEY = "hera_sk_live_a8f2e91c4b7d6e3f5a2c8b1d9e4f7a6c";

const Settings = () => {
  const [workspace, setWorkspace] = useState("Acme Compliance Team");
  const [apiKey, setApiKey] = useState(INITIAL_KEY);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");

  const masked = `${apiKey.slice(0, 12)}${"•".repeat(16)}${apiKey.slice(-4)}`;

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast("API key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = () => {
    const newKey = `hera_sk_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    setApiKey(newKey);
    setRevealed(true);
    toast("API key regenerated. Previous key is now invalid.");
  };

  const saveWorkspace = () => {
    toast(`Workspace renamed to "${workspace}"`);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-mono font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your workspace, credentials, and access controls.
          </p>
        </div>

        {/* Workspace */}
        <section className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-mono font-semibold text-sm">Workspace</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Display name shown across the compliance portal.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="label-tag block mb-2">Workspace Name</label>
              <input
                type="text"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="label-tag mb-1">Workspace ID</p>
                <p className="text-xs font-mono text-muted-foreground">ws_7f3a8b2c4e91d4f0</p>
              </div>
              <div>
                <p className="label-tag mb-1">Plan</p>
                <p className="text-xs font-mono text-foreground">Enterprise</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={saveWorkspace}
                className="px-5 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </section>

        {/* API Key */}
        <section className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-mono font-semibold text-sm">API Key</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Used to authenticate programmatic access to the Hera API.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 bg-muted border border-border px-3 py-2.5">
              <code className="flex-1 text-xs font-mono text-foreground truncate">
                {revealed ? apiKey : masked}
              </code>
              <button
                onClick={() => setRevealed((r) => !r)}
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
            <div className="flex items-start gap-3 border border-secondary/20 bg-secondary/5 p-3">
              <AlertTriangle className="w-3.5 h-3.5 text-secondary mt-0.5 shrink-0" />
              <p className="text-xs text-secondary/90 leading-relaxed">
                Treat this key like a password. Rotating it will immediately invalidate the previous key for all integrations.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={regenerate}
                className="inline-flex items-center gap-2 px-5 py-2 border border-border text-xs uppercase tracking-[0.08em] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate Key
              </button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border border-destructive/30 bg-destructive/5"
        >
          <div className="px-6 py-4 border-b border-destructive/20">
            <h2 className="font-mono font-semibold text-sm text-destructive">Danger Zone</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Irreversible actions. Proceed with caution.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Delete Workspace</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete this workspace, all cases, reports, and audit logs. This cannot be undone.
              </p>
            </div>
            <div>
              <label className="label-tag block mb-2">
                Type <span className="text-destructive font-mono">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-destructive placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="flex justify-end">
              <button
                disabled={confirmDelete !== "DELETE"}
                onClick={() => toast("Workspace deletion requested (mock)")}
                className="px-5 py-2 bg-destructive text-destructive-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-destructive/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Delete Workspace
              </button>
            </div>
          </div>
        </motion.section>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
