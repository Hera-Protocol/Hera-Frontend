import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusPill } from "@/components/StatusPill";
import { ChainBadge } from "@/components/ChainBadge";
import { ScanProgress } from "@/components/ScanProgress";
import { mockCases, mockEvents, SCAN_STAGES, REPORT_HASH, type ScanStage, type EventType } from "@/data/mock";
import { motion } from "framer-motion";
import { Copy, Download, Lock, Check } from "lucide-react";
import { toast } from "sonner";

const eventColors: Record<EventType, string> = {
  RECEIVE: "bg-primary/15 text-primary",
  SEND: "bg-secondary/15 text-secondary",
  SHIELD: "bg-zcash/15 text-zcash",
  UNSHIELD: "bg-destructive/15 text-destructive",
};

const CaseDetail = () => {
  const { caseId } = useParams();
  const caseData = mockCases.find((c) => c.id === caseId) || mockCases[0];

  // Scan simulation
  const [stageIdx, setStageIdx] = useState(
    caseData.status === "SIGNED" ? SCAN_STAGES.length - 1 : 0
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (caseData.status === "SIGNED" || caseData.status === "FAILED") return;
    const interval = setInterval(() => {
      setStageIdx((prev) => {
        if (prev >= SCAN_STAGES.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [caseData.status]);

  const currentStage: ScanStage = SCAN_STAGES[stageIdx];
  const isSigned = currentStage === "SIGNED" || caseData.status === "SIGNED";

  const copyHash = () => {
    navigator.clipboard.writeText(REPORT_HASH);
    setCopied(true);
    toast("Report hash copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold">{caseData.id}</h1>
            <button
              onClick={() => {
                navigator.clipboard.writeText(caseData.id);
                toast("Case ID copied");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <ChainBadge chain={caseData.chain} />
          <StatusPill status={isSigned ? "SIGNED" : caseData.status} />
        </div>

        {/* Progress */}
        <div className="border border-border bg-card p-6">
          <p className="label-tag mb-2">Scan Progress</p>
          <ScanProgress currentStage={currentStage} />
        </div>

        {/* Event Timeline */}
        <div>
          <h2 className="text-sm font-mono font-semibold mb-4 uppercase tracking-wider text-muted-foreground">
            Event Timeline
          </h2>
          <div className="border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 label-tag">Block</th>
                  <th className="text-left px-4 py-3 label-tag">Timestamp</th>
                  <th className="text-left px-4 py-3 label-tag">Type</th>
                  <th className="text-left px-4 py-3 label-tag">Asset</th>
                  <th className="text-right px-4 py-3 label-tag">Amount</th>
                  <th className="text-left px-4 py-3 label-tag">Proof</th>
                  <th className="text-left px-4 py-3 label-tag">Counterparty</th>
                </tr>
              </thead>
              <tbody>
                {mockEvents.map((e, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{e.blockHeight}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{e.timestamp}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${eventColors[e.eventType]}`}>
                        {e.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{e.asset}</td>
                    <td className="px-4 py-3 font-mono text-xs text-right">{e.amount}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary font-medium">
                        {e.ownershipProof}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {e.counterpartyVisibility === "UNKNOWN" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="w-3 h-3" />
                          Unknown
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Partial</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Report Actions */}
        {isSigned && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-primary/20 bg-primary/5 p-6 space-y-4"
          >
            <p className="label-tag text-primary">Report Ready</p>
            <div className="flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 px-5 py-2 border border-primary text-primary text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/10 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Download JSON Report
              </button>
              <button className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Download PDF Report
              </button>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs font-mono text-muted-foreground truncate max-w-md">
                {REPORT_HASH}
              </span>
              <button onClick={copyHash} className="text-muted-foreground hover:text-foreground shrink-0">
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CaseDetail;
