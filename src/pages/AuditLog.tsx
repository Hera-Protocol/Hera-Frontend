import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { mockAuditLog } from "@/data/mock";
import { motion } from "framer-motion";

const actionTypes = ["ALL", "CASE_CREATED", "SCAN_STARTED", "SCAN_COMPLETED", "REPORT_DOWNLOADED", "KEY_IMPORTED"];

const AuditLog = () => {
  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL"
    ? mockAuditLog
    : mockAuditLog.filter((e) => e.action === filter);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete activity history</p>
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
                  <td className="px-4 py-3 font-mono text-xs">{entry.timestamp}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.actor}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{entry.action}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.resource}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.ip}</td>
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
