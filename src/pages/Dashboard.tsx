import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusPill } from "@/components/StatusPill";
import { ChainBadge } from "@/components/ChainBadge";
import { mockCases } from "@/data/mock";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FolderOpen, FileText, Clock, Eye } from "lucide-react";

const stats = [
  { label: "Active Cases", value: "4", icon: FolderOpen },
  { label: "Reports Generated", value: "12", icon: FileText },
  { label: "Last Scan", value: "2h ago", icon: Clock },
];

const Dashboard = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-mono font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Compliance overview</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="label-tag">{s.label}</span>
                <s.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-mono font-bold">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Recent Cases */}
        <div>
          <h2 className="text-sm font-mono font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Recent Cases</h2>
          <div className="border border-border bg-card overflow-hidden">
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
                {mockCases.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{c.id}</td>
                    <td className="px-4 py-3"><ChainBadge chain={c.chain} /></td>
                    <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.created}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/case/${c.id}`}
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
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
