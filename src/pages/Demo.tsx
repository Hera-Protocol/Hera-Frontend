import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileText,
  Lock,
  Play,
  Shield,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { HexBackground } from "@/components/HexBackground";
import {
  DEMO_CASE_ID,
  DEMO_STANDARD_RESPONSE,
  DEMO_ZK_RESPONSE,
  ZK_PROOF_TYPES,
  type DemoResponse,
  type DemoReportEvent,
  type DemoAttestation,
} from "@/data/demo-data";

type DemoMode = "standard" | "zk";

type ScanPhase =
  | "idle"
  | "connecting"
  | "syncing"
  | "detecting"
  | "classifying"
  | "signing"
  | "complete";

const SCAN_STEPS: { phase: ScanPhase; label: string; duration: number }[] = [
  { phase: "connecting", label: "Connecting to lightwalletd node...", duration: 800 },
  { phase: "syncing", label: "Syncing blocks 2,100,000 — 2,100,501...", duration: 1400 },
  { phase: "detecting", label: "Detecting shielded notes across 4 transactions...", duration: 1000 },
  { phase: "classifying", label: "Classifying flows — RECEIVE, SEND, FEE...", duration: 900 },
  { phase: "signing", label: "Generating ed25519 signature...", duration: 700 },
  { phase: "complete", label: "Scan complete. Report ready.", duration: 0 },
];

const eventTypeColor: Record<string, string> = {
  RECEIVE: "text-primary",
  SEND: "text-secondary",
  SHIELD: "text-zcash",
  UNSHIELD: "text-destructive",
  FEE: "text-muted-foreground",
};

const eventTypeBg: Record<string, string> = {
  RECEIVE: "bg-primary/15 text-primary",
  SEND: "bg-secondary/15 text-secondary",
  SHIELD: "bg-zcash/15 text-zcash",
  UNSHIELD: "bg-destructive/15 text-destructive",
  FEE: "bg-muted text-muted-foreground",
};

function truncateHash(hash: string, chars = 8): string {
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

function formatZecAmount(amount: string): string {
  const num = parseFloat(amount);
  return num.toFixed(8);
}

/* ─── Scan Terminal ──────────────────────────────────── */

function ScanTerminal({
  lines,
  phase,
}: {
  lines: { text: string; status: "ok" | "loading" | "done" }[];
  phase: ScanPhase;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <div className="border border-border bg-card overflow-hidden rounded-[6px]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] font-mono text-muted-foreground">
          hera scan --chain zcash --key zxviews1q0...f8a2
        </span>
        {phase !== "idle" && phase !== "complete" && (
          <span className="ml-auto w-2 h-2 rounded-full bg-secondary status-pulse" />
        )}
        {phase === "complete" && (
          <CheckCircle2 className="ml-auto w-3.5 h-3.5 text-primary" />
        )}
      </div>
      <div ref={scrollRef} className="p-4 font-mono text-xs leading-6 max-h-52 overflow-y-auto">
        {lines.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span
              className={
                line.status === "ok"
                  ? "text-primary"
                  : line.status === "done"
                  ? "text-success"
                  : "text-secondary"
              }
            >
              [{line.status === "ok" ? "OK" : line.status === "done" ? "OK" : ".."}]
            </span>{" "}
            <span className="text-muted-foreground">{line.text}</span>
          </motion.p>
        ))}
        {phase !== "idle" && phase !== "complete" && (
          <span className="text-foreground blink">_</span>
        )}
      </div>
    </div>
  );
}

/* ─── Mode Toggle ────────────────────────────────────── */

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: DemoMode;
  onChange: (m: DemoMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex border border-border rounded-[6px] overflow-hidden">
      <button
        onClick={() => onChange("standard")}
        disabled={disabled}
        className={`px-4 py-2 text-xs uppercase tracking-[0.08em] font-medium transition-colors ${
          mode === "standard"
            ? "bg-primary text-primary-foreground"
            : "bg-card text-muted-foreground hover:text-foreground"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <FileText className="w-3 h-3 inline mr-1.5 -mt-0.5" />
        Standard
      </button>
      <button
        onClick={() => onChange("zk")}
        disabled={disabled}
        className={`px-4 py-2 text-xs uppercase tracking-[0.08em] font-medium transition-colors border-l border-border ${
          mode === "zk"
            ? "bg-secondary text-secondary-foreground"
            : "bg-card text-muted-foreground hover:text-foreground"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <Shield className="w-3 h-3 inline mr-1.5 -mt-0.5" />
        ZK Mode
      </button>
    </div>
  );
}

/* ─── Summary Cards ──────────────────────────────────── */

function SummaryCards({ data }: { data: DemoResponse }) {
  const { summary } = data.report;
  const cards = [
    { label: "Total Received", value: `${formatZecAmount(summary.total_received)} ZEC`, accent: "text-primary" },
    { label: "Total Sent", value: `${formatZecAmount(summary.total_sent)} ZEC`, accent: "text-secondary" },
    { label: "Events Detected", value: data.report.total_events.toString(), accent: "text-foreground" },
    { label: "Audit Period", value: `${new Date(summary.audit_start).toLocaleDateString()} — ${new Date(summary.audit_end).toLocaleDateString()}`, accent: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="border border-border bg-card p-4 rounded-[6px]"
        >
          <p className="label-tag mb-1">{card.label}</p>
          <p className={`text-lg font-mono font-bold ${card.accent}`}>{card.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Event Timeline Table ───────────────────────────── */

function EventTable({ events }: { events: DemoReportEvent[] }) {
  return (
    <div className="border border-border bg-card overflow-hidden rounded-[6px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 label-tag">Block</th>
            <th className="text-left px-4 py-3 label-tag">Timestamp</th>
            <th className="text-left px-4 py-3 label-tag">Type</th>
            <th className="text-left px-4 py-3 label-tag">Asset</th>
            <th className="text-right px-4 py-3 label-tag">Amount</th>
            <th className="text-left px-4 py-3 label-tag">Pool</th>
            <th className="text-left px-4 py-3 label-tag">Counterparty</th>
            <th className="text-left px-4 py-3 label-tag">Memo</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, i) => (
            <motion.tr
              key={event.event_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <td className="px-4 py-3 font-mono text-xs">{event.block_height.toLocaleString()}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                {new Date(event.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${eventTypeBg[event.event_type]}`}>
                  {event.event_type}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{event.asset.symbol}</td>
              <td className={`px-4 py-3 font-mono text-xs text-right ${eventTypeColor[event.event_type]}`}>
                {event.event_type === "SEND" || event.event_type === "FEE" ? "-" : "+"}
                {formatZecAmount(event.amount)}
              </td>
              <td className="px-4 py-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {event.provenance.pool}
                </span>
              </td>
              <td className="px-4 py-3">
                {event.counterparty.visibility === "UNKNOWN" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="w-3 h-3" />
                    Shielded
                  </span>
                ) : (
                  <span className="text-xs font-mono text-muted-foreground">
                    {event.counterparty.value}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {event.memo.present ? (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary font-medium">
                    <Eye className="w-3 h-3" />
                    Present
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/50">None</span>
                )}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Signature Panel ────────────────────────────────── */

function SignaturePanel({ signature }: { signature: DemoResponse["report"]["signature"] }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    toast(`${label} copied`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-primary/20 bg-primary/5 p-5 rounded-[6px] space-y-3"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <p className="label-tag text-primary">Cryptographic Signature — {signature.algorithm.toUpperCase()}</p>
      </div>
      <div className="space-y-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 shrink-0">Public Key</span>
          <span className="text-foreground truncate">{truncateHash(signature.public_key_hex, 16)}</span>
          <button onClick={() => copy("Public key", signature.public_key_hex)} className="shrink-0 text-muted-foreground hover:text-foreground">
            {copied === "Public key" ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 shrink-0">Signature</span>
          <span className="text-foreground truncate">{truncateHash(signature.signature_hex, 16)}</span>
          <button onClick={() => copy("Signature", signature.signature_hex)} className="shrink-0 text-muted-foreground hover:text-foreground">
            {copied === "Signature" ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 shrink-0">Signed At</span>
          <span className="text-foreground">{new Date(signature.signed_at).toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── ZK Attestation Panel ───────────────────────────── */

function AttestationPanel({ attestation }: { attestation: DemoAttestation }) {
  const [expanded, setExpanded] = useState(false);
  const proofMeta = ZK_PROOF_TYPES.find((p) => p.id === attestation.proof_type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-secondary/30 bg-secondary/5 p-5 rounded-[6px] space-y-4"
    >
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-secondary" />
        <p className="label-tag text-secondary">Stage 3 — ZK / Caulk+ Attestation</p>
        {attestation.verified && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium bg-success/15 text-success rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <p className="text-muted-foreground mb-0.5">Proof Type</p>
          <p className="text-foreground font-medium">{attestation.proof_type}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">SRS Version</p>
          <p className="text-foreground font-medium">{attestation.srs_version}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Threshold</p>
          <p className="text-foreground font-medium">{(attestation.public_inputs.threshold / 1e8).toFixed(2)} ZEC</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Event Count</p>
          <p className="text-foreground font-medium">{attestation.public_inputs.event_count}</p>
        </div>
      </div>

      {proofMeta && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {proofMeta.description}
        </p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-secondary font-medium hover:text-secondary/80 transition-colors"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        {expanded ? "Hide" : "Show"} Proof Hash
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 text-xs font-mono py-2">
              <span className="text-muted-foreground">sha256:</span>
              <span className="text-foreground truncate">{attestation.proof_sha256}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(attestation.proof_sha256);
                  toast("Proof hash copied");
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Available proof types */}
      <div className="pt-2 border-t border-secondary/10">
        <p className="label-tag mb-2">Available ZK Proof Types</p>
        <div className="flex flex-wrap gap-2">
          {ZK_PROOF_TYPES.map((pt) => (
            <span
              key={pt.id}
              className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-medium rounded-full border ${
                pt.id === attestation.proof_type
                  ? "bg-secondary/15 text-secondary border-secondary/30"
                  : "bg-muted/50 text-muted-foreground border-border"
              }`}
            >
              {pt.id.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Flow Breakdown Chart ───────────────────────────── */

function FlowBreakdown({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const bars = Object.entries(counts).filter(([, v]) => v > 0);

  return (
    <div className="border border-border bg-card p-5 rounded-[6px]">
      <p className="label-tag mb-3">Event Type Breakdown</p>
      <div className="space-y-2">
        {bars.map(([type, count]) => {
          const pct = Math.round((count / total) * 100);
          const colorClass = eventTypeBg[type.toUpperCase()] ?? "bg-muted text-muted-foreground";
          return (
            <div key={type} className="flex items-center gap-3">
              <span className={`w-20 text-[10px] uppercase tracking-wider font-medium ${colorClass} px-2 py-0.5 text-center`}>
                {type}
              </span>
              <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className={`h-full rounded-full ${
                    type.toUpperCase() === "RECEIVE"
                      ? "bg-primary"
                      : type.toUpperCase() === "SEND"
                      ? "bg-secondary"
                      : "bg-muted-foreground/50"
                  }`}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-8 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Demo Page ─────────────────────────────────── */

const Demo = () => {
  const [mode, setMode] = useState<DemoMode>("standard");
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [terminalLines, setTerminalLines] = useState<{ text: string; status: "ok" | "loading" | "done" }[]>([]);
  const [reportData, setReportData] = useState<DemoResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timeoutRef.current.forEach(clearTimeout);
    timeoutRef.current = [];
  }, []);

  const runScan = useCallback(() => {
    clearTimers();
    setIsScanning(true);
    setReportData(null);
    setTerminalLines([]);
    setScanPhase("idle");

    let elapsed = 300;

    // Initial line
    const t0 = setTimeout(() => {
      setTerminalLines([{ text: `Initializing scan — mode=${mode}`, status: "ok" }]);
      setScanPhase("connecting");
    }, elapsed);
    timeoutRef.current.push(t0);

    SCAN_STEPS.forEach((step, i) => {
      elapsed += step.duration;
      const t = setTimeout(() => {
        setScanPhase(step.phase);
        setTerminalLines((prev) => {
          const updated = [...prev];
          // Mark previous loading line as ok
          let lastLoading = -1;
          for (let j = updated.length - 1; j >= 0; j--) {
            if (updated[j].status === "loading") { lastLoading = j; break; }
          }
          if (lastLoading >= 0) updated[lastLoading] = { ...updated[lastLoading], status: "ok" };
          // Add new line
          updated.push({
            text: step.label,
            status: step.phase === "complete" ? "done" : "loading",
          });
          return updated;
        });

        if (step.phase === "complete") {
          const data = mode === "zk" ? DEMO_ZK_RESPONSE : DEMO_STANDARD_RESPONSE;
          setReportData(data);
          setIsScanning(false);

          // Add final summary lines
          setTerminalLines((prev) => [
            ...prev,
            { text: `Report generated — sha256:${data.report.signature.signature_hex.slice(0, 12)}...`, status: "ok" },
            { text: `Signed with ed25519 workspace key`, status: "ok" },
            ...(mode === "zk"
              ? [{ text: `ZK attestation verified — proof_type=THRESHOLD_RECEIVED` as string, status: "ok" as const }]
              : []),
          ]);
        }
      }, elapsed);
      timeoutRef.current.push(t);
    });
  }, [mode, clearTimers]);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  const handleModeChange = (newMode: DemoMode) => {
    if (isScanning) return;
    setMode(newMode);
    setReportData(null);
    setTerminalLines([]);
    setScanPhase("idle");
  };

  const downloadMockJson = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hera-report-${mode}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Report JSON downloaded");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Logo size={24} />
          </Link>
          <span className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 bg-primary/15 text-primary rounded-full">
            Compliance Audit
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-16 px-6 md:px-12 border-b border-border overflow-hidden">
        <HexBackground />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="label-tag mb-3">Shielded Chain Compliance</p>
            <h1 className="text-3xl md:text-5xl font-mono font-bold leading-tight">
              Run a{" "}
              <span className="text-primary">Zcash audit</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Scan shielded Zcash Sapling activity using a viewing key. Toggle between Standard (Stage 2 signed report)
              and ZK Mode (Stage 3 Caulk+ attestation) for the full compliance pipeline.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Controls */}
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-8 space-y-8">
        {/* Mode + Run */}
        <div className="flex flex-wrap items-center gap-4">
          <ModeToggle mode={mode} onChange={handleModeChange} disabled={isScanning} />
          <button
            onClick={runScan}
            disabled={isScanning}
            className={`inline-flex items-center gap-2 px-6 py-2.5 text-xs uppercase tracking-[0.08em] font-medium transition-colors rounded-[6px] ${
              isScanning
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {isScanning ? (
              <>
                <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run Scan
              </>
            )}
          </button>
          <span className="text-xs font-mono text-muted-foreground">
            Case: {DEMO_CASE_ID.slice(0, 8)}... | Chain: ZCASH | Network: MAINNET
          </span>
        </div>

        {/* Scan progress bar */}
        {scanPhase !== "idle" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-1 w-full">
              {SCAN_STEPS.map((step, i) => {
                const currentIdx = SCAN_STEPS.findIndex((s) => s.phase === scanPhase);
                const isComplete = i < currentIdx;
                const isActive = i === currentIdx;
                return (
                  <div key={step.phase} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full h-1.5 rounded-full transition-colors duration-300 ${
                        isComplete
                          ? "bg-primary"
                          : isActive
                          ? "bg-secondary"
                          : "bg-muted/50"
                      }`}
                    />
                    <span
                      className={`text-[9px] uppercase tracking-wider ${
                        isComplete ? "text-primary" : isActive ? "text-secondary" : "text-muted-foreground/40"
                      }`}
                    >
                      {step.phase}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Terminal */}
        {terminalLines.length > 0 && (
          <ScanTerminal lines={terminalLines} phase={scanPhase} />
        )}

        {/* Report */}
        <AnimatePresence>
          {reportData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Report header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-mono font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Audit Report
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal ml-1">
                      v{reportData.report.manifest_version}
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {reportData.report.chain} / {reportData.report.network} — Generated{" "}
                    {new Date(reportData.report.generated_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={downloadMockJson}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-primary text-primary text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/10 transition-colors rounded-[6px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export JSON
                </button>
              </div>

              {/* Summary cards */}
              <SummaryCards data={reportData} />

              {/* Flow breakdown */}
              <FlowBreakdown counts={reportData.report.summary.event_type_counts} />

              {/* Event timeline */}
              <div>
                <h3 className="text-sm font-mono font-semibold mb-3 uppercase tracking-wider text-muted-foreground">
                  Event Timeline
                </h3>
                <EventTable events={reportData.report.events} />
              </div>

              {/* Signature */}
              <SignaturePanel signature={reportData.report.signature} />

              {/* ZK Attestation (only in ZK mode) */}
              {reportData.attestation && (
                <AttestationPanel attestation={reportData.attestation} />
              )}

              {/* Mode explanation */}
              <div className="border border-border bg-card p-5 rounded-[6px]">
                <div className="flex items-start gap-3">
                  <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-mono font-semibold mb-1">
                      {mode === "standard" ? "Stage 2 — Standard Compliance" : "Stage 3 — ZK-Caulk+ Verification"}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {mode === "standard"
                        ? "This report contains a cryptographically signed audit of all shielded transaction activity detected by the viewing key. The ed25519 signature ensures tamper-evidence. Suitable for standard regulatory reporting."
                        : "This report includes an additional zero-knowledge attestation layer using the Caulk+ proof system. The ZK proof verifies compliance properties (e.g. total received exceeds a threshold) without revealing the underlying transaction data. This enables minimal-disclosure compliance."}
                    </p>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Idle state prompt */}
        {scanPhase === "idle" && !reportData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Play className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Select a mode and click <strong className="text-foreground">Run Scan</strong> to begin a Zcash compliance audit.
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6 mt-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <Logo size={18} />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Privacy-compliance infrastructure for the shielded web.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Demo;
