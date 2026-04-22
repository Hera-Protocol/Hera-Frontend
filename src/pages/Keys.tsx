import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChainBadge } from "@/components/ChainBadge";
import { motion } from "framer-motion";
import { ShieldAlert, Trash2, KeyRound, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { Chain } from "@/data/mock";

interface KeyEntry {
  fingerprint: string;
  chain: Chain;
  added: string;
  casesLinked: number;
}

const initialKeys: KeyEntry[] = [
  { fingerprint: "zxv1q9k4...e3a2c891", chain: "Zcash", added: "2026-04-14", casesLinked: 1 },
  { fingerprint: "nam1vk88...77fe21bc", chain: "Namada", added: "2026-04-15", casesLinked: 1 },
  { fingerprint: "zxv1m2n7...0a4d11ff", chain: "Zcash", added: "2026-04-16", casesLinked: 1 },
  { fingerprint: "nam1vkaa...c5912b03", chain: "Namada", added: "2026-04-13", casesLinked: 1 },
];

const Keys = () => {
  const [keys, setKeys] = useState<KeyEntry[]>(initialKeys);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const confirmDelete = (fp: string) => {
    setKeys((prev) => prev.filter((k) => k.fingerprint !== fp));
    setPendingDelete(null);
    toast(`Viewing key ${fp.slice(0, 8)}... removed`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Viewing Keys</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage encrypted viewing keys per case</p>
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
            Viewing keys are encrypted at rest using AES-256 with per-tenant KMS wrapping. Hera never sees raw keys after submission.
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
                  <th className="text-left px-4 py-3 label-tag">Fingerprint</th>
                  <th className="text-left px-4 py-3 label-tag">Chain</th>
                  <th className="text-left px-4 py-3 label-tag">Added</th>
                  <th className="text-left px-4 py-3 label-tag">Cases Linked</th>
                  <th className="text-right px-4 py-3 label-tag">Action</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k, i) => (
                  <motion.tr
                    key={k.fingerprint}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{k.fingerprint}</td>
                    <td className="px-4 py-3"><ChainBadge chain={k.chain} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{k.added}</td>
                    <td className="px-4 py-3 text-xs font-mono">{k.casesLinked}</td>
                    <td className="px-4 py-3 text-right">
                      {pendingDelete === k.fingerprint ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setPendingDelete(null)}
                            className="px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => confirmDelete(k.fingerprint)}
                            className="px-2 py-1 text-[11px] uppercase tracking-[0.08em] bg-destructive text-destructive-foreground rounded-[6px]"
                          >
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingDelete(k.fingerprint)}
                          className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 uppercase tracking-[0.1em]"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
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
