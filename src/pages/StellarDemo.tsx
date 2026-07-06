import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileText,
  Globe,
  KeyRound,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Terminal,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { HexBackground } from "@/components/HexBackground";
import {
  STELLAR_DEMO_CASE_ID,
  STELLAR_DEMO_RESPONSE,
  STELLAR_KYT_RESPONSE,
  SEP_PROTOCOLS,
  ACCOUNT_FORM_LABELS,
  type StellarDemoResponse,
  type StellarDemoEvent,
  type Sep10Auth,
  type Sep12KycSubmission,
  type Sep8Approval,
  type ResolvedAccount,
  type AccountForm,
} from "@/data/stellar-demo-data";

/* ─── Types ──────────────────────────────────────────── */

type DemoMode = "compliance" | "kyt";

type ScanPhase =
  | "idle"
  | "authenticating"
  | "resolving"
  | "screening"
  | "enforcing"
  | "signing"
  | "complete";

const SCAN_STEPS: { phase: ScanPhase; label: string; duration: number }[] = [
  { phase: "authenticating", label: "SEP-10 challenge — verifying account ownership via web_auth_endpoint...", duration: 900 },
  { phase: "resolving", label: "Resolving accounts — G..., M... muxed, G+memo forms → individual customer records...", duration: 1200 },
  { phase: "screening", label: "SEP-12 KYC check — validating customer data against SEP-9 field standards...", duration: 1100 },
  { phase: "enforcing", label: "SEP-8 pre-settlement enforcement — screening 6 transactions against sanctions & thresholds...", duration: 1300 },
  { phase: "signing", label: "Generating ed25519 compliance report signature...", duration: 700 },
  { phase: "complete", label: "Scan complete. Stellar compliance report ready.", duration: 0 },
];

/* ─── Color Maps ─────────────────────────────────────── */

const eventTypeColor: Record<string, string> = {
  PAYMENT: "text-secondary",
  PATH_PAYMENT: "text-primary",
  CREATE_ACCOUNT: "text-zcash",
  CLAWBACK: "text-destructive",
  FEE: "text-muted-foreground",
};

const eventTypeBg: Record<string, string> = {
  PAYMENT: "bg-secondary/15 text-secondary",
  PATH_PAYMENT: "bg-primary/15 text-primary",
  CREATE_ACCOUNT: "bg-zcash/15 text-zcash",
  CLAWBACK: "bg-destructive/15 text-destructive",
  FEE: "bg-muted text-muted-foreground",
};

const sep8StatusColor: Record<string, string> = {
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  revised: "bg-primary/15 text-primary",
  pending: "bg-muted text-muted-foreground",
};

const kycStatusColor: Record<string, string> = {
  verified: "text-success",
  pending: "text-primary",
  unverified: "text-muted-foreground",
  blocked: "text-destructive",
};

const riskColor: Record<string, string> = {
  low: "bg-success/15 text-success",
  medium: "bg-primary/15 text-primary",
  high: "bg-destructive/15 text-destructive",
  critical: "bg-destructive/30 text-destructive",
};

const accountFormColor: Record<AccountForm, string> = {
  G_address: "bg-secondary/15 text-secondary border-secondary/30",
  M_muxed: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  G_memo: "bg-primary/15 text-primary border-primary/30",
};

/* ─── Helpers ────────────────────────────────────────── */

function truncateHash(hash: string, chars = 8): string {
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
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
          hera scan --chain stellar --anchor exampleanchor.com
        </span>
        {phase !== "idle" && phase !== "complete" && (
          <span className="ml-auto w-2 h-2 rounded-full bg-secondary status-pulse" />
        )}
        {phase === "complete" && (
          <CheckCircle2 className="ml-auto w-3.5 h-3.5 text-success" />
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
                  ? "text-success"
                  : line.status === "done"
                  ? "text-success"
                  : "text-secondary"
              }
            >
              [{line.status === "ok" ? "OK" : line.status === "done" ? "DONE" : ".."}]
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
        onClick={() => onChange("compliance")}
        disabled={disabled}
        className={`px-4 py-2 text-xs uppercase tracking-[0.08em] font-medium transition-colors ${
          mode === "compliance"
            ? "bg-secondary text-secondary-foreground"
            : "bg-card text-muted-foreground hover:text-foreground"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <ShieldCheck className="w-3 h-3 inline mr-1.5 -mt-0.5" />
        Compliance
      </button>
      <button
        onClick={() => onChange("kyt")}
        disabled={disabled}
        className={`px-4 py-2 text-xs uppercase tracking-[0.08em] font-medium transition-colors border-l border-border ${
          mode === "kyt"
            ? "bg-primary text-primary-foreground"
            : "bg-card text-muted-foreground hover:text-foreground"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <Eye className="w-3 h-3 inline mr-1.5 -mt-0.5" />
        KYT
      </button>
    </div>
  );
}

/* ─── Summary Cards ──────────────────────────────────── */

function SummaryCards({ data }: { data: StellarDemoResponse }) {
  const { summary } = data.report;
  const cards = [
    { label: "Total Volume", value: `$${summary.total_volume_usd}`, accent: "text-secondary" },
    { label: "Payments", value: summary.total_payments.toString(), accent: "text-foreground" },
    { label: "KYC Coverage", value: summary.kyc_coverage, accent: "text-success" },
    { label: "Unique Accounts", value: summary.unique_accounts.toString(), accent: "text-foreground" },
    { label: "Sanctions Hits", value: summary.sanctions_hits.toString(), accent: summary.sanctions_hits > 0 ? "text-destructive" : "text-success" },
    { label: "SEP-8 Rejections", value: summary.sep8_rejections.toString(), accent: summary.sep8_rejections > 0 ? "text-destructive" : "text-success" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="border border-border bg-card p-4 rounded-[6px]"
        >
          <p className="label-tag mb-1">{card.label}</p>
          <p className={`text-lg font-mono font-bold ${card.accent}`}>{card.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── SEP Protocol Badges ────────────────────────────── */

function SepProtocolBar() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-secondary/20 bg-secondary/5 p-5 rounded-[6px] space-y-4"
    >
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-secondary" />
        <p className="label-tag text-secondary">Native SEP Protocol Support</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SEP_PROTOCOLS.map((sep) => (
          <button
            key={sep.id}
            onClick={() => setExpanded(expanded === sep.id ? null : sep.id)}
            className={`text-left p-3 border rounded-[6px] transition-all ${
              expanded === sep.id
                ? "border-secondary/40 bg-secondary/10"
                : "border-border hover:border-secondary/20"
            }`}
          >
            <p className="text-xs font-mono font-bold text-secondary">{sep.id}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{sep.label}</p>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-secondary/10">
              {SEP_PROTOCOLS.find((s) => s.id === expanded)?.description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Account Resolution Panel ───────────────────────── */

function AccountBadge({ account }: { account: ResolvedAccount }) {
  const formInfo = ACCOUNT_FORM_LABELS[account.form];
  return (
    <div className="border border-border bg-card p-4 rounded-[6px] space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded border ${accountFormColor[account.form]}`}>
          {formInfo.label}
        </span>
        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${riskColor[account.risk_rating]}`}>
          {account.risk_rating} risk
        </span>
        <span className={`text-[10px] uppercase tracking-wider font-medium ${kycStatusColor[account.kyc_status]}`}>
          KYC: {account.kyc_status}
        </span>
      </div>
      <p className="text-xs font-mono text-foreground">{account.display}</p>
      {account.federation_address && (
        <p className="text-[11px] text-muted-foreground">
          <Globe className="w-3 h-3 inline mr-1 -mt-0.5" />
          {account.federation_address}
        </p>
      )}
      {account.form === "M_muxed" && account.muxed_address && (
        <div className="text-[11px] space-y-0.5 pl-3 border-l-2 border-blue-400/30">
          <p className="text-muted-foreground">
            <span className="text-blue-400 font-medium">M...</span> {truncateHash(account.muxed_address, 6)}
          </p>
          <p className="text-muted-foreground">
            Parent G...: {truncateHash(account.g_address, 6)}
          </p>
          <p className="text-muted-foreground">
            Sub-account ID: <span className="text-foreground font-mono">{account.muxed_id}</span>
          </p>
        </div>
      )}
      {account.form === "G_memo" && account.memo && (
        <div className="text-[11px] space-y-0.5 pl-3 border-l-2 border-primary/30">
          <p className="text-muted-foreground">
            G...: {truncateHash(account.g_address, 6)}
          </p>
          <p className="text-muted-foreground">
            Memo ({account.memo_type}): <span className="text-foreground font-mono">{account.memo}</span>
          </p>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/60 font-mono">
        ID: {account.customer_id}
      </p>
    </div>
  );
}

function AccountResolutionPanel({ events }: { events: StellarDemoEvent[] }) {
  const seen = new Map<string, ResolvedAccount>();
  events.forEach((e) => {
    if (!seen.has(e.source_account.customer_id)) seen.set(e.source_account.customer_id, e.source_account);
    if (!seen.has(e.destination_account.customer_id)) seen.set(e.destination_account.customer_id, e.destination_account);
  });
  const accounts = Array.from(seen.values());

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-muted-foreground">
          Muxed Account Resolution
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {accounts.length} accounts resolved
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Hera resolves all three Stellar account forms — <span className="text-secondary font-medium">G... addresses</span>,{" "}
        <span className="text-blue-400 font-medium">M... muxed accounts</span>, and{" "}
        <span className="text-primary font-medium">G... + memo pairs</span> — to individual customer records.
        Competing platforms collapse muxed accounts into the parent G... address, losing sub-account granularity.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((acct) => (
          <AccountBadge key={acct.customer_id} account={acct} />
        ))}
      </div>
    </div>
  );
}

/* ─── SEP-10 Auth Sessions ───────────────────────────── */

function Sep10Panel({ sessions }: { sessions: Sep10Auth[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-secondary" />
        <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-muted-foreground">
          SEP-10 Authentication Sessions
        </h3>
      </div>
      <div className="border border-border bg-card overflow-hidden rounded-[6px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 label-tag">Account</th>
              <th className="text-left px-4 py-3 label-tag">Memo</th>
              <th className="text-left px-4 py-3 label-tag">Home Domain</th>
              <th className="text-left px-4 py-3 label-tag">Client Domain</th>
              <th className="text-left px-4 py-3 label-tag">Signed At</th>
              <th className="text-left px-4 py-3 label-tag">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs">{truncateHash(session.account, 6)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {session.memo ? `${session.memo_type}:${session.memo}` : "—"}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-secondary">{session.home_domain}</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                  {session.client_domain || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  {new Date(session.signed_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {session.verified ? (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-success">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-destructive">
                      <XCircle className="w-3 h-3" />
                      Failed
                    </span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── SEP-12 KYC Panel ───────────────────────────────── */

function Sep12Panel({ submissions }: { submissions: Sep12KycSubmission[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const statusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
      case "pending": return <AlertTriangle className="w-3.5 h-3.5 text-primary" />;
      case "rejected": return <XCircle className="w-3.5 h-3.5 text-destructive" />;
      default: return <AlertTriangle className="w-3.5 h-3.5 text-primary" />;
    }
  };

  const fieldStatusColor: Record<string, string> = {
    accepted: "text-success",
    pending: "text-primary",
    rejected: "text-destructive",
    needs_info: "text-primary",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-muted-foreground">
          SEP-12 KYC Submissions
        </h3>
        <span className="text-[10px] text-muted-foreground/60 ml-1">SEP-9 field standards</span>
      </div>
      <div className="space-y-3">
        {submissions.map((sub) => (
          <motion.div
            key={sub.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-border bg-card rounded-[6px] overflow-hidden"
          >
            <button
              onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
            >
              {statusIcon(sub.status)}
              <span className="text-xs font-mono text-foreground">{truncateHash(sub.account, 6)}</span>
              {sub.memo && (
                <span className="text-[10px] text-muted-foreground">memo:{sub.memo}</span>
              )}
              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${
                sub.status === "approved" ? "bg-success/15 text-success" :
                sub.status === "pending" ? "bg-primary/15 text-primary" :
                "bg-destructive/15 text-destructive"
              }`}>
                {sub.status}
              </span>
              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium bg-muted text-muted-foreground rounded">
                {sub.kyc_level}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">{sub.type}</span>
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${expandedId === sub.id ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {expandedId === sub.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <p className="label-tag mb-2 text-primary">SEP-9 Fields Provided</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {sub.fields_provided.map((field) => (
                        <div key={field.field_name} className="text-xs space-y-0.5">
                          <p className="text-muted-foreground font-mono">{field.field_name}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-foreground">{field.value}</span>
                            <span className={`text-[9px] uppercase ${fieldStatusColor[field.status]}`}>
                              {field.status === "needs_info" ? "NEEDS INFO" : field.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground font-mono">
                      <span>Submitted: {new Date(sub.submitted_at).toLocaleString()}</span>
                      <span>Updated: {new Date(sub.updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── SEP-8 Pre-Settlement Panel ─────────────────────── */

function Sep8Panel({ approvals }: { approvals: Sep8Approval[] }) {
  const statusIcon = (status: string) => {
    switch (status) {
      case "approved": return <ShieldCheck className="w-4 h-4 text-success" />;
      case "rejected": return <ShieldX className="w-4 h-4 text-destructive" />;
      case "revised": return <ShieldAlert className="w-4 h-4 text-primary" />;
      default: return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-destructive" />
        <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-muted-foreground">
          SEP-8 Pre-Settlement Enforcement
        </h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Non-compliant transactions are <span className="text-destructive font-medium">blocked before settlement</span>, not flagged after the fact.
        Every transaction is screened against sanctions lists, Travel Rule requirements, and amount thresholds before it hits the ledger.
      </p>
      <div className="space-y-2">
        {approvals.map((approval, i) => (
          <motion.div
            key={approval.tx_hash}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`border rounded-[6px] p-4 space-y-2 ${
              approval.status === "rejected"
                ? "border-destructive/30 bg-destructive/5"
                : approval.status === "revised"
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              {statusIcon(approval.status)}
              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${sep8StatusColor[approval.status]}`}>
                {approval.status}
              </span>
              <span className="text-xs font-mono text-muted-foreground">{truncateHash(approval.tx_hash, 8)}</span>
              <span className="text-[10px] text-muted-foreground ml-auto font-mono">{approval.regulated_asset}</span>
            </div>

            <div className="flex gap-4 text-[10px] font-mono">
              <span className={approval.sanctions_check ? "text-success" : "text-destructive"}>
                Sanctions: {approval.sanctions_check ? "PASS" : "FAIL"}
              </span>
              <span className={approval.travel_rule_check ? "text-success" : "text-destructive"}>
                Travel Rule: {approval.travel_rule_check ? "PASS" : "FAIL"}
              </span>
              <span className={approval.amount_threshold_check ? "text-success" : "text-destructive"}>
                Threshold: {approval.amount_threshold_check ? "PASS" : "FAIL"}
              </span>
            </div>

            {approval.reason && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {approval.reason}
              </p>
            )}
            {approval.action_required && (
              <p className="text-xs text-primary leading-relaxed">
                <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
                {approval.action_required}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Event Timeline ─────────────────────────────────── */

function EventTimeline({ events }: { events: StellarDemoEvent[] }) {
  const [selectedEvent, setSelectedEvent] = useState<StellarDemoEvent | null>(null);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-muted-foreground">
        Transaction Timeline
      </h3>
      <div className="border border-border bg-card overflow-hidden rounded-[6px]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 label-tag">Ledger</th>
                <th className="text-left px-4 py-3 label-tag">Time</th>
                <th className="text-left px-4 py-3 label-tag">Type</th>
                <th className="text-left px-4 py-3 label-tag">Asset</th>
                <th className="text-right px-4 py-3 label-tag">Amount</th>
                <th className="text-left px-4 py-3 label-tag">From</th>
                <th className="text-left px-4 py-3 label-tag">To</th>
                <th className="text-left px-4 py-3 label-tag">SEP-8</th>
                <th className="text-left px-4 py-3 label-tag">Flags</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <motion.tr
                  key={event.event_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onClick={() => setSelectedEvent(selectedEvent?.event_id === event.event_id ? null : event)}
                  className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                    selectedEvent?.event_id === event.event_id ? "bg-muted/30" : "hover:bg-muted/20"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{event.ledger.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${eventTypeBg[event.event_type]}`}>
                      {event.event_type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{event.asset.code}</td>
                  <td className={`px-4 py-3 font-mono text-xs text-right ${eventTypeColor[event.event_type]}`}>
                    {parseFloat(event.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                      event.source_account.form === "M_muxed" ? "bg-blue-400" :
                      event.source_account.form === "G_memo" ? "bg-primary" : "bg-secondary"
                    }`} />
                    {event.source_account.display}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                      event.destination_account.form === "M_muxed" ? "bg-blue-400" :
                      event.destination_account.form === "G_memo" ? "bg-primary" : "bg-secondary"
                    }`} />
                    {event.destination_account.display}
                  </td>
                  <td className="px-4 py-3">
                    {event.sep8_approval ? (
                      <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${sep8StatusColor[event.sep8_approval.status]}`}>
                        {event.sep8_approval.status}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {event.compliance_flags.slice(0, 2).map((flag) => (
                        <span
                          key={flag}
                          className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium rounded ${
                            flag.includes("REJECTED") || flag.includes("SANCTIONS") || flag.includes("BLOCKED")
                              ? "bg-destructive/15 text-destructive"
                              : flag.includes("REVISED") || flag.includes("PARTIAL") || flag.includes("EDD")
                              ? "bg-primary/15 text-primary"
                              : "bg-success/15 text-success"
                          }`}
                        >
                          {flag.replace(/_/g, " ")}
                        </span>
                      ))}
                      {event.compliance_flags.length > 2 && (
                        <span className="text-[9px] text-muted-foreground">+{event.compliance_flags.length - 2}</span>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded event detail */}
      <AnimatePresence>
        {selectedEvent && selectedEvent.travel_rule && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-secondary/20 bg-secondary/5 p-4 rounded-[6px] space-y-3">
              <p className="label-tag text-secondary">Travel Rule Data — {truncateHash(selectedEvent.tx_hash, 8)}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">Originator</p>
                  <p className="text-foreground font-medium">{selectedEvent.travel_rule.originator}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Beneficiary</p>
                  <p className="text-foreground font-medium">{selectedEvent.travel_rule.beneficiary}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Originator VASP</p>
                  <p className="text-foreground font-mono">{selectedEvent.travel_rule.originator_vasp}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Beneficiary VASP</p>
                  <p className="text-foreground font-mono">{selectedEvent.travel_rule.beneficiary_vasp}</p>
                </div>
              </div>
              {selectedEvent.memo && selectedEvent.memo.value && (
                <p className="text-xs text-muted-foreground">
                  Memo ({selectedEvent.memo.type}): <span className="text-foreground font-mono">{selectedEvent.memo.value}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Flow Breakdown ─────────────────────────────────── */

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
          return (
            <div key={type} className="flex items-center gap-3">
              <span className={`w-24 text-[10px] uppercase tracking-wider font-medium ${eventTypeBg[type.toUpperCase()] ?? "bg-muted text-muted-foreground"} px-2 py-0.5 text-center rounded`}>
                {type.replace("_", " ")}
              </span>
              <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className={`h-full rounded-full ${
                    type.toUpperCase() === "PAYMENT"
                      ? "bg-secondary"
                      : type.toUpperCase() === "PATH_PAYMENT"
                      ? "bg-primary"
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

/* ─── Signature Panel ────────────────────────────────── */

function SignaturePanel({ signature }: { signature: StellarDemoResponse["report"]["signature"] }) {
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
      className="border border-success/20 bg-success/5 p-5 rounded-[6px] space-y-3"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-success" />
        <p className="label-tag text-success">Cryptographic Signature — {signature.algorithm.toUpperCase()}</p>
      </div>
      <div className="space-y-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 shrink-0">Public Key</span>
          <span className="text-foreground truncate">{truncateHash(signature.public_key_hex, 16)}</span>
          <button onClick={() => copy("Public key", signature.public_key_hex)} className="shrink-0 text-muted-foreground hover:text-foreground">
            {copied === "Public key" ? <CheckCircle2 className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 shrink-0">Signature</span>
          <span className="text-foreground truncate">{truncateHash(signature.signature_hex, 16)}</span>
          <button onClick={() => copy("Signature", signature.signature_hex)} className="shrink-0 text-muted-foreground hover:text-foreground">
            {copied === "Signature" ? <CheckCircle2 className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
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

/* ─── Main Stellar Demo Page ─────────────────────────── */

const StellarDemo = () => {
  const [mode, setMode] = useState<DemoMode>("compliance");
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [terminalLines, setTerminalLines] = useState<{ text: string; status: "ok" | "loading" | "done" }[]>([]);
  const [reportData, setReportData] = useState<StellarDemoResponse | null>(null);
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

    const t0 = setTimeout(() => {
      setTerminalLines([{ text: `Initializing Stellar compliance scan — mode=${mode}`, status: "ok" }]);
      setScanPhase("authenticating");
    }, elapsed);
    timeoutRef.current.push(t0);

    SCAN_STEPS.forEach((step) => {
      elapsed += step.duration;
      const t = setTimeout(() => {
        setScanPhase(step.phase);
        setTerminalLines((prev) => {
          const updated = [...prev];
          let lastLoading = -1;
          for (let j = updated.length - 1; j >= 0; j--) {
            if (updated[j].status === "loading") { lastLoading = j; break; }
          }
          if (lastLoading >= 0) updated[lastLoading] = { ...updated[lastLoading], status: "ok" };
          updated.push({
            text: step.label,
            status: step.phase === "complete" ? "done" : "loading",
          });
          return updated;
        });

        if (step.phase === "complete") {
          const data = mode === "kyt" ? STELLAR_KYT_RESPONSE : STELLAR_DEMO_RESPONSE;
          setReportData(data);
          setIsScanning(false);

          setTerminalLines((prev) => [
            ...prev,
            { text: `Report generated — 6 events, 6 accounts resolved, 5 SEP-8 checks`, status: "ok" },
            { text: `1 transaction blocked pre-settlement (OFAC sanctions match)`, status: "ok" },
            { text: `Signed with ed25519 workspace key`, status: "ok" },
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
    link.download = `hera-stellar-${mode}-report.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Stellar compliance report downloaded");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Logo size={24} />
          </Link>
          <span className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 bg-secondary/15 text-secondary rounded-full">
            Stellar Compliance
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/demo"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Zcash Demo
          </Link>
          <span className="text-muted-foreground/30">|</span>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-16 px-6 md:px-12 border-b border-border overflow-hidden">
        <HexBackground />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="label-tag mb-3">Stellar-Native Compliance & KYT</p>
            <h1 className="text-3xl md:text-5xl font-mono font-bold leading-tight">
              Run a{" "}
              <span className="text-secondary">Stellar compliance</span>{" "}
              audit
            </h1>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Native SEP-10 authentication, SEP-12 KYC submission with SEP-9 field standards,
              and SEP-8 pre-settlement enforcement — purpose-built for Stellar Anchors,
              cross-border payment corridors, and tokenised asset issuers.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              {["SEP-10", "SEP-12", "SEP-9", "SEP-8"].map((sep) => (
                <span key={sep} className="px-3 py-1 text-[11px] font-mono font-bold text-secondary bg-secondary/10 border border-secondary/20 rounded-full">
                  {sep}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Controls */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-8 space-y-8">
        {/* Mode + Run */}
        <div className="flex flex-wrap items-center gap-4">
          <ModeToggle mode={mode} onChange={handleModeChange} disabled={isScanning} />
          <button
            onClick={runScan}
            disabled={isScanning}
            className={`inline-flex items-center gap-2 px-6 py-2.5 text-xs uppercase tracking-[0.08em] font-medium transition-colors rounded-[6px] ${
              isScanning
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
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
                Run Compliance Scan
              </>
            )}
          </button>
          <span className="text-xs font-mono text-muted-foreground">
            Case: {STELLAR_DEMO_CASE_ID.slice(0, 12)}... | Chain: STELLAR | Network: MAINNET
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
                          ? "bg-success"
                          : isActive
                          ? "bg-secondary"
                          : "bg-muted/50"
                      }`}
                    />
                    <span
                      className={`text-[9px] uppercase tracking-wider ${
                        isComplete ? "text-success" : isActive ? "text-secondary" : "text-muted-foreground/40"
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
              className="space-y-8"
            >
              {/* Report header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-mono font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-secondary" />
                    Stellar Compliance Report
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
                  className="inline-flex items-center gap-2 px-4 py-2 border border-secondary text-secondary text-xs uppercase tracking-[0.08em] font-medium hover:bg-secondary/10 transition-colors rounded-[6px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export JSON
                </button>
              </div>

              {/* Summary cards */}
              <SummaryCards data={reportData} />

              {/* SEP Protocol overview */}
              <SepProtocolBar />

              {/* Account Resolution */}
              <AccountResolutionPanel events={reportData.report.events} />

              {/* SEP-10 Auth */}
              <Sep10Panel sessions={reportData.report.sep10_sessions} />

              {/* SEP-12 KYC */}
              <Sep12Panel submissions={reportData.report.sep12_submissions} />

              {/* SEP-8 Pre-Settlement */}
              <Sep8Panel approvals={reportData.report.sep8_approvals} />

              {/* Flow breakdown */}
              <FlowBreakdown counts={reportData.report.summary.event_type_counts} />

              {/* Event timeline */}
              <EventTimeline events={reportData.report.events} />

              {/* Signature */}
              <SignaturePanel signature={reportData.report.signature} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Idle state */}
        {scanPhase === "idle" && !reportData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
              <Play className="w-6 h-6 text-secondary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Ready to scan. Click <strong className="text-foreground">Run Compliance Scan</strong> to begin.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2 max-w-md">
              This demo simulates a full Stellar Anchor compliance workflow — SEP-10 authentication,
              SEP-12 KYC verification, muxed account resolution, and SEP-8 pre-settlement enforcement.
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <Logo size={18} />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Stellar-native compliance infrastructure for Anchors, payment corridors, and tokenised asset issuers.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default StellarDemo;
