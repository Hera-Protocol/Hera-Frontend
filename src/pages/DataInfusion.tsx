import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hash,
  User,
  Globe,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/DashboardLayout";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RiskRating = "low" | "medium" | "high" | "severe";
type KycStatus = "verified" | "unverified" | "unknown";
type Direction = "sent" | "received";

interface StellarTransaction {
  id: string;
  txHash: string;
  timestamp: string;
  fromAddress: string;
  toAddress: string;
  asset: string;
  amount: string;
  memo: string | null;
  memoType: "text" | "hash" | "return" | "none";
  muxedAccount: {
    mAddress: string;
    parentGAddress: string;
    subAccountId: string;
  } | null;
  direction: Direction;
  riskScore: number;
  riskRating: RiskRating;
  riskFlags: string[];
  chainalysisExposures: { category: string; value: number }[];
  fromKyc: { status: KycStatus; entity: string | null; tier: string | null; jurisdiction: string | null };
  toKyc: { status: KycStatus; entity: string | null; tier: string | null; jurisdiction: string | null };
  complianceDecision: "cleared" | "alert_raised" | "pending_review";
  alertId: string | null;
}

// ---------------------------------------------------------------------------
// Mock data — realistic Stellar transactions with Chainalysis-style risk data
// ---------------------------------------------------------------------------

const MOCK_TRANSACTIONS: StellarTransaction[] = [
  {
    id: "evt-001",
    txHash: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    timestamp: "2026-06-22T09:15:32Z",
    fromAddress: "GABC2DEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
    toAddress: "GXYZ7ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRS",
    asset: "USDC",
    amount: "12500.00",
    memo: "INV-2026-0847",
    memoType: "text",
    muxedAccount: null,
    direction: "received",
    riskScore: 15,
    riskRating: "low",
    riskFlags: [],
    chainalysisExposures: [],
    fromKyc: { status: "verified", entity: "Acme Corp Ltd", tier: "enhanced", jurisdiction: "DK" },
    toKyc: { status: "verified", entity: "Hera Client Wallet", tier: "standard", jurisdiction: "DK" },
    complianceDecision: "cleared",
    alertId: null,
  },
  {
    id: "evt-002",
    txHash: "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567a",
    timestamp: "2026-06-22T08:42:17Z",
    fromAddress: "GXYZ7ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRS",
    toAddress: "GDEF9HIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    asset: "XLM",
    amount: "950000.00",
    memo: null,
    memoType: "none",
    muxedAccount: {
      mAddress: "MDEF9HIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ0000000042",
      parentGAddress: "GDEF9HIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      subAccountId: "42",
    },
    direction: "sent",
    riskScore: 55,
    riskRating: "medium",
    riskFlags: ["large_transaction", "unhosted_wallet"],
    chainalysisExposures: [
      { category: "exchange", value: 0.4 },
      { category: "unhosted", value: 0.6 },
    ],
    fromKyc: { status: "verified", entity: "Hera Client Wallet", tier: "standard", jurisdiction: "DK" },
    toKyc: { status: "unknown", entity: null, tier: null, jurisdiction: null },
    complianceDecision: "pending_review",
    alertId: "alert-002",
  },
  {
    id: "evt-003",
    txHash: "c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567ab2",
    timestamp: "2026-06-22T07:28:05Z",
    fromAddress: "GMIX3OPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345678",
    toAddress: "GXYZ7ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRS",
    asset: "USDC",
    amount: "78200.00",
    memo: "SWAP-DEFI-9182",
    memoType: "text",
    muxedAccount: null,
    direction: "received",
    riskScore: 82,
    riskRating: "high",
    riskFlags: ["exposure_to_mixer", "high_risk_jurisdiction", "rapid_movement"],
    chainalysisExposures: [
      { category: "mixing_service", value: 0.35 },
      { category: "high_risk_exchange", value: 0.25 },
      { category: "unknown", value: 0.4 },
    ],
    fromKyc: { status: "unverified", entity: null, tier: null, jurisdiction: null },
    toKyc: { status: "verified", entity: "Hera Client Wallet", tier: "standard", jurisdiction: "DK" },
    complianceDecision: "alert_raised",
    alertId: "alert-003",
  },
  {
    id: "evt-004",
    txHash: "d4e5f6789012345678901234567890abcdef1234567890abcdef1234567ab2c3",
    timestamp: "2026-06-22T06:55:41Z",
    fromAddress: "GXYZ7ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRS",
    toAddress: "GPAY5STUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDE",
    asset: "EURC",
    amount: "2400.00",
    memo: "Payroll-June-W3",
    memoType: "text",
    muxedAccount: null,
    direction: "sent",
    riskScore: 8,
    riskRating: "low",
    riskFlags: [],
    chainalysisExposures: [],
    fromKyc: { status: "verified", entity: "Hera Client Wallet", tier: "standard", jurisdiction: "DK" },
    toKyc: { status: "verified", entity: "PayrollCo ApS", tier: "standard", jurisdiction: "DK" },
    complianceDecision: "cleared",
    alertId: null,
  },
  {
    id: "evt-005",
    txHash: "e5f6789012345678901234567890abcdef1234567890abcdef1234567ab2c3d4",
    timestamp: "2026-06-21T22:10:09Z",
    fromAddress: "GSAN1LMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345",
    toAddress: "GXYZ7ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRS",
    asset: "XLM",
    amount: "1500000.00",
    memo: null,
    memoType: "none",
    muxedAccount: null,
    direction: "received",
    riskScore: 95,
    riskRating: "severe",
    riskFlags: ["sanctioned_entity", "exposure_to_darknet", "structuring_pattern"],
    chainalysisExposures: [
      { category: "sanctioned_entity", value: 0.7 },
      { category: "darknet_market", value: 0.2 },
      { category: "unknown", value: 0.1 },
    ],
    fromKyc: { status: "unverified", entity: null, tier: null, jurisdiction: null },
    toKyc: { status: "verified", entity: "Hera Client Wallet", tier: "standard", jurisdiction: "DK" },
    complianceDecision: "alert_raised",
    alertId: "alert-005",
  },
  {
    id: "evt-006",
    txHash: "f6789012345678901234567890abcdef1234567890abcdef1234567ab2c3d4e5",
    timestamp: "2026-06-21T18:33:27Z",
    fromAddress: "GABC2DEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
    toAddress: "GXYZ7ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRS",
    asset: "USDC",
    amount: "500.00",
    memo: "coffee-fund",
    memoType: "text",
    muxedAccount: null,
    direction: "received",
    riskScore: 3,
    riskRating: "low",
    riskFlags: [],
    chainalysisExposures: [],
    fromKyc: { status: "verified", entity: "Acme Corp Ltd", tier: "enhanced", jurisdiction: "DK" },
    toKyc: { status: "verified", entity: "Hera Client Wallet", tier: "standard", jurisdiction: "DK" },
    complianceDecision: "cleared",
    alertId: null,
  },
  {
    id: "evt-007",
    txHash: "07890abcdef1234567890abcdef1234567ab2c3d4e5f6789012345678901234",
    timestamp: "2026-06-21T14:05:58Z",
    fromAddress: "GXYZ7ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRS",
    toAddress: "GEXC4UVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFG",
    asset: "USDC",
    amount: "35000.00",
    memo: "TR:BENEFICIARY:SE:GEXC4UV",
    memoType: "text",
    muxedAccount: {
      mAddress: "MEXC4UVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFG0000000099",
      parentGAddress: "GEXC4UVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFG",
      subAccountId: "99",
    },
    direction: "sent",
    riskScore: 45,
    riskRating: "medium",
    riskFlags: ["travel_rule_gap"],
    chainalysisExposures: [
      { category: "exchange", value: 0.95 },
      { category: "unknown", value: 0.05 },
    ],
    fromKyc: { status: "verified", entity: "Hera Client Wallet", tier: "standard", jurisdiction: "DK" },
    toKyc: { status: "verified", entity: "Exchange: Stellar DEX Aggregator", tier: "standard", jurisdiction: "SE" },
    complianceDecision: "pending_review",
    alertId: "alert-007",
  },
  {
    id: "evt-008",
    txHash: "890abcdef1234567890abcdef1234567ab2c3d4e5f6789012345678901234567",
    timestamp: "2026-06-21T11:22:13Z",
    fromAddress: "GXYZ7ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRS",
    toAddress: "GABC2DEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
    asset: "XLM",
    amount: "100.00",
    memo: "test-tx",
    memoType: "text",
    muxedAccount: null,
    direction: "sent",
    riskScore: 2,
    riskRating: "low",
    riskFlags: [],
    chainalysisExposures: [],
    fromKyc: { status: "verified", entity: "Hera Client Wallet", tier: "standard", jurisdiction: "DK" },
    toKyc: { status: "verified", entity: "Acme Corp Ltd", tier: "enhanced", jurisdiction: "DK" },
    complianceDecision: "cleared",
    alertId: null,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function riskColor(rating: RiskRating): string {
  switch (rating) {
    case "low": return "text-green-400";
    case "medium": return "text-amber-400";
    case "high": return "text-orange-400";
    case "severe": return "text-red-400";
  }
}

function riskBgColor(rating: RiskRating): string {
  switch (rating) {
    case "low": return "bg-green-400/10 border-green-400/20";
    case "medium": return "bg-amber-400/10 border-amber-400/20";
    case "high": return "bg-orange-400/10 border-orange-400/20";
    case "severe": return "bg-red-400/10 border-red-400/20";
  }
}

function riskDotColor(rating: RiskRating): string {
  switch (rating) {
    case "low": return "bg-green-400";
    case "medium": return "bg-amber-400";
    case "high": return "bg-orange-400";
    case "severe": return "bg-red-400";
  }
}

function riskLabel(rating: RiskRating): string {
  switch (rating) {
    case "low": return "Low Risk";
    case "medium": return "Medium Risk";
    case "high": return "High Risk";
    case "severe": return "Severe";
  }
}

function RiskShieldIcon({ rating, className }: { rating: RiskRating; className?: string }) {
  const cn = `${className ?? "w-4 h-4"} ${riskColor(rating)}`;
  switch (rating) {
    case "low": return <ShieldCheck className={cn} />;
    case "medium": return <Shield className={cn} />;
    case "high": return <ShieldAlert className={cn} />;
    case "severe": return <ShieldX className={cn} />;
  }
}

function kycBadge(status: KycStatus): { label: string; className: string } {
  switch (status) {
    case "verified": return { label: "Verified", className: "text-green-400 bg-green-400/10" };
    case "unverified": return { label: "Unverified", className: "text-red-400 bg-red-400/10" };
    case "unknown": return { label: "Unknown", className: "text-muted-foreground bg-muted" };
  }
}

function decisionBadge(decision: string): { label: string; className: string; icon: typeof CheckCircle2 } {
  switch (decision) {
    case "cleared": return { label: "Cleared", className: "text-green-400 bg-green-400/10", icon: CheckCircle2 };
    case "alert_raised": return { label: "Alert Raised", className: "text-red-400 bg-red-400/10", icon: AlertTriangle };
    case "pending_review": return { label: "Pending Review", className: "text-amber-400 bg-amber-400/10", icon: Clock };
    default: return { label: decision, className: "text-muted-foreground bg-muted", icon: Clock };
  }
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 hover:bg-muted rounded transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Risk filters
// ---------------------------------------------------------------------------

const RISK_FILTERS = ["ALL", "LOW", "MEDIUM", "HIGH", "SEVERE"] as const;
type RiskFilter = typeof RISK_FILTERS[number];

// ---------------------------------------------------------------------------
// Transaction Detail Sheet
// ---------------------------------------------------------------------------

function TransactionDetail({ tx, onClose }: { tx: StellarTransaction; onClose: () => void }) {
  const decision = decisionBadge(tx.complianceDecision);
  const DecisionIcon = decision.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full max-w-2xl bg-card border-l border-border overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <RiskShieldIcon rating={tx.riskRating} className="w-5 h-5" />
            <div>
              <h2 className="font-mono text-sm font-semibold">Canonical Compliance Event</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{formatTimestamp(tx.timestamp)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Risk overview */}
          <div className={`border rounded-[6px] p-4 ${riskBgColor(tx.riskRating)}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RiskShieldIcon rating={tx.riskRating} className="w-5 h-5" />
                <span className={`text-sm font-semibold ${riskColor(tx.riskRating)}`}>{riskLabel(tx.riskRating)}</span>
              </div>
              <span className={`text-2xl font-mono font-bold ${riskColor(tx.riskRating)}`}>{tx.riskScore}</span>
            </div>
            {/* Risk bar */}
            <div className="w-full h-2 bg-background/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${riskDotColor(tx.riskRating)}`}
                style={{ width: `${tx.riskScore}%` }}
              />
            </div>
            {tx.riskFlags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tx.riskFlags.map((flag) => (
                  <span key={flag} className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium bg-background/40 rounded">
                    {flag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Compliance decision */}
          <div className="border border-border rounded-[6px] p-4">
            <span className="label-tag block mb-2">Compliance Decision</span>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-xs font-medium uppercase tracking-wider ${decision.className}`}>
              <DecisionIcon className="w-3.5 h-3.5" />
              {decision.label}
            </div>
            {tx.alertId && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">Alert ID: {tx.alertId}</p>
            )}
          </div>

          {/* Transaction info */}
          <div className="border border-border rounded-[6px] p-4 space-y-3">
            <span className="label-tag block mb-1">Transaction</span>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">TX Hash</span>
                <div className="flex items-center gap-1">
                  <span className="text-foreground">{truncateAddress(tx.txHash)}</span>
                  <CopyButton text={tx.txHash} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Chain</span>
                <span className="text-foreground">Stellar</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Asset</span>
                <span className="text-foreground">{tx.asset}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground font-semibold">{Number(tx.amount).toLocaleString()} {tx.asset}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Direction</span>
                <span className={`flex items-center gap-1 ${tx.direction === "received" ? "text-green-400" : "text-blue-400"}`}>
                  {tx.direction === "received" ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                  {tx.direction === "received" ? "Received" : "Sent"}
                </span>
              </div>
              {tx.memo && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Memo</span>
                  <div className="flex items-center gap-1">
                    <span className="text-foreground">{tx.memo}</span>
                    {tx.memo.startsWith("TR:") && (
                      <span className="ml-1 px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-blue-400/10 text-blue-400 rounded">
                        Travel Rule
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Muxed account resolution */}
          {tx.muxedAccount && (
            <div className="border border-blue-400/20 bg-blue-400/5 rounded-[6px] p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Hash className="w-3.5 h-3.5 text-blue-400" />
                <span className="label-tag text-blue-400">Muxed Account Resolution</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-start justify-between">
                  <span className="text-muted-foreground">M... Address</span>
                  <div className="flex items-center gap-1">
                    <span className="text-foreground">{truncateAddress(tx.muxedAccount.mAddress)}</span>
                    <CopyButton text={tx.muxedAccount.mAddress} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Parent G... Account</span>
                  <div className="flex items-center gap-1">
                    <span className="text-foreground">{truncateAddress(tx.muxedAccount.parentGAddress)}</span>
                    <CopyButton text={tx.muxedAccount.parentGAddress} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sub-Account ID</span>
                  <span className="text-blue-400 font-semibold">#{tx.muxedAccount.subAccountId}</span>
                </div>
              </div>
            </div>
          )}

          {/* From address KYC */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-border rounded-[6px] p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="label-tag">From</span>
              </div>
              <div className="text-xs font-mono space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">{truncateAddress(tx.fromAddress)}</span>
                  <CopyButton text={tx.fromAddress} />
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${kycBadge(tx.fromKyc.status).className}`}>
                    <User className="w-2.5 h-2.5" />
                    {kycBadge(tx.fromKyc.status).label}
                  </span>
                </div>
                {tx.fromKyc.entity && (
                  <p className="text-foreground text-xs">{tx.fromKyc.entity}</p>
                )}
                {tx.fromKyc.jurisdiction && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Globe className="w-2.5 h-2.5" />
                    {tx.fromKyc.jurisdiction}
                  </p>
                )}
              </div>
            </div>

            <div className="border border-border rounded-[6px] p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="label-tag">To</span>
              </div>
              <div className="text-xs font-mono space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">{truncateAddress(tx.toAddress)}</span>
                  <CopyButton text={tx.toAddress} />
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${kycBadge(tx.toKyc.status).className}`}>
                    <User className="w-2.5 h-2.5" />
                    {kycBadge(tx.toKyc.status).label}
                  </span>
                </div>
                {tx.toKyc.entity && (
                  <p className="text-foreground text-xs">{tx.toKyc.entity}</p>
                )}
                {tx.toKyc.jurisdiction && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Globe className="w-2.5 h-2.5" />
                    {tx.toKyc.jurisdiction}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Chainalysis Exposures */}
          {tx.chainalysisExposures.length > 0 && (
            <div className="border border-border rounded-[6px] p-4">
              <span className="label-tag block mb-3">Chainalysis Exposure Breakdown</span>
              <div className="space-y-2">
                {tx.chainalysisExposures.map((exp) => (
                  <div key={exp.category} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-muted-foreground capitalize">{exp.category.replace(/_/g, " ")}</span>
                        <span className="font-mono text-foreground">{(exp.value * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${exp.value * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const DataInfusion = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");
  const [selectedTx, setSelectedTx] = useState<StellarTransaction | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const filteredTransactions = useMemo(() => {
    let txs = MOCK_TRANSACTIONS;
    if (riskFilter !== "ALL") {
      txs = txs.filter((tx) => tx.riskRating === riskFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      txs = txs.filter(
        (tx) =>
          tx.txHash.toLowerCase().includes(q) ||
          tx.fromAddress.toLowerCase().includes(q) ||
          tx.toAddress.toLowerCase().includes(q) ||
          tx.asset.toLowerCase().includes(q) ||
          (tx.memo && tx.memo.toLowerCase().includes(q)) ||
          (tx.fromKyc.entity && tx.fromKyc.entity.toLowerCase().includes(q)) ||
          (tx.toKyc.entity && tx.toKyc.entity.toLowerCase().includes(q))
      );
    }
    return txs;
  }, [riskFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = MOCK_TRANSACTIONS.length;
    const lowCount = MOCK_TRANSACTIONS.filter((t) => t.riskRating === "low").length;
    const medCount = MOCK_TRANSACTIONS.filter((t) => t.riskRating === "medium").length;
    const highCount = MOCK_TRANSACTIONS.filter((t) => t.riskRating === "high").length;
    const severeCount = MOCK_TRANSACTIONS.filter((t) => t.riskRating === "severe").length;
    const alertCount = MOCK_TRANSACTIONS.filter((t) => t.complianceDecision === "alert_raised").length;
    return { total, lowCount, medCount, highCount, severeCount, alertCount };
  }, []);

  const handleGeneratePdf = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      setIsGeneratingPdf(false);
      toast.success("Signed compliance PDF report downloaded.");
    }, 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-mono font-bold">Data Infusion</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Stellar transaction screening &mdash; Chainalysis KYT risk scores, KYC status, compliance decisions
            </p>
          </div>
          <button
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium rounded-[6px] hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Export PDF Report
              </>
            )}
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Transactions", value: stats.total, color: "text-foreground" },
            { label: "Low Risk", value: stats.lowCount, color: "text-green-400" },
            { label: "Medium", value: stats.medCount, color: "text-amber-400" },
            { label: "High", value: stats.highCount, color: "text-orange-400" },
            { label: "Severe", value: stats.severeCount, color: "text-red-400" },
            { label: "Alerts", value: stats.alertCount, color: "text-red-400" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border border-border bg-card p-4 rounded-[6px]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="label-tag text-[10px]">{stat.label}</span>
              </div>
              <p className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Search + filter tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search address, tx hash, entity, memo..."
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-[6px] text-sm font-mono focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-1">
            {RISK_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setRiskFilter(f)}
                className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] font-medium border rounded-[6px] transition-colors ${
                  riskFilter === f
                    ? "border-primary text-primary bg-primary/5"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction table */}
        {filteredTransactions.length === 0 ? (
          <div className="border border-border bg-card p-16 text-center rounded-[6px]">
            <Search className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No transactions match your search.</p>
          </div>
        ) : (
          <div className="border border-border bg-card overflow-x-auto rounded-[6px]">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 label-tag">Risk</th>
                  <th className="text-left px-4 py-3 label-tag">Time</th>
                  <th className="text-left px-4 py-3 label-tag">Direction</th>
                  <th className="text-left px-4 py-3 label-tag">Amount</th>
                  <th className="text-left px-4 py-3 label-tag">Counterparty</th>
                  <th className="text-left px-4 py-3 label-tag">KYC</th>
                  <th className="text-left px-4 py-3 label-tag">Memo</th>
                  <th className="text-left px-4 py-3 label-tag">Decision</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, i) => {
                  const counterparty = tx.direction === "received" ? tx.fromAddress : tx.toAddress;
                  const counterpartyKyc = tx.direction === "received" ? tx.fromKyc : tx.toKyc;
                  const kyc = kycBadge(counterpartyKyc.status);
                  const decision = decisionBadge(tx.complianceDecision);
                  const DecisionIcon = decision.icon;

                  return (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelectedTx(tx)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      {/* Risk */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${riskDotColor(tx.riskRating)}`} />
                          <span className={`font-mono text-xs font-semibold ${riskColor(tx.riskRating)}`}>{tx.riskScore}</span>
                        </div>
                      </td>
                      {/* Time */}
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {formatTimestamp(tx.timestamp)}
                      </td>
                      {/* Direction */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${tx.direction === "received" ? "text-green-400" : "text-blue-400"}`}>
                          {tx.direction === "received" ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {tx.direction === "received" ? "IN" : "OUT"}
                        </span>
                      </td>
                      {/* Amount */}
                      <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                        {Number(tx.amount).toLocaleString()} <span className="text-muted-foreground font-normal">{tx.asset}</span>
                      </td>
                      {/* Counterparty */}
                      <td className="px-4 py-3">
                        <div className="text-xs font-mono">
                          <span className="text-muted-foreground">{truncateAddress(counterparty)}</span>
                          {counterpartyKyc.entity && (
                            <p className="text-[11px] text-foreground/70 mt-0.5 truncate max-w-[150px]">{counterpartyKyc.entity}</p>
                          )}
                        </div>
                      </td>
                      {/* KYC */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${kyc.className}`}>
                          {kyc.label}
                        </span>
                      </td>
                      {/* Memo */}
                      <td className="px-4 py-3">
                        {tx.memo ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">{tx.memo}</span>
                            {tx.muxedAccount && (
                              <span className="px-1 py-0.5 text-[9px] uppercase tracking-wider bg-blue-400/10 text-blue-400 rounded" title="Muxed account resolved">
                                MUX
                              </span>
                            )}
                          </div>
                        ) : tx.muxedAccount ? (
                          <span className="px-1 py-0.5 text-[9px] uppercase tracking-wider bg-blue-400/10 text-blue-400 rounded" title="Muxed account resolved">
                            MUX
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">&mdash;</span>
                        )}
                      </td>
                      {/* Decision */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${decision.className}`}>
                          <DecisionIcon className="w-2.5 h-2.5" />
                          {decision.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Compliance report card */}
        <div className="border border-border bg-card rounded-[6px] p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-[6px] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-mono text-sm font-semibold">Signed Compliance Report</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Cryptographically signed PDF — all screened transactions, risk scores, KYC status,
                memo fields, muxed account resolutions. Immutable and timestamped for regulatory audit.
              </p>
            </div>
            <button
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium rounded-[6px] hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Generate & Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Transaction detail slide-over */}
      <AnimatePresence>
        {selectedTx && <TransactionDetail tx={selectedTx} onClose={() => setSelectedTx(null)} />}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default DataInfusion;
