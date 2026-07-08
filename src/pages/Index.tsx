import { HexBackground } from "@/components/HexBackground";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Search,
  RefreshCw,
  FileText,
  Star,
  AlertTriangle,
  Clock,
  Building2,
  Globe,
  TrendingUp,
  Landmark,
  Shield,
  Activity,
  Bell,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------------
// Section 3 — Problem
// ---------------------------------------------------------------------------

const problems = [
  {
    title: "Data is fragmented",
    description:
      "Transaction records live on-chain. Risk intelligence lives in tools like Chainalysis. KYC data lives in separate systems. No single platform connects them — until now.",
  },
  {
    title: "Monitoring is reactive",
    description:
      "Most teams discover compliance issues after the fact. By the time a report is generated, the damage is done. Institutions need real-time intelligence, not post-event summaries.",
  },
  {
    title: "Reporting is manual",
    description:
      "Compliance teams spend weeks assembling documentation for regulators, exchanges, and investors. The process is slow, error-prone, and impossible to scale.",
  },
];

// ---------------------------------------------------------------------------
// Section 5 — Core Platform
// ---------------------------------------------------------------------------

const platformFeatures = [
  {
    icon: Search,
    title: "KYC Automation",
    description:
      "Onboard and verify customers at scale. Hera integrates identity verification directly into your blockchain workflow — collecting, validating, and maintaining KYC records in line with FATF, MiCA, and jurisdiction-specific requirements.",
    bullets: [
      "Document verification and liveness checks",
      "Tiered KYC based on transaction limits and jurisdiction",
      "Continuous re-verification and status monitoring",
      "Native Stellar SEP-10 / SEP-12 / SEP-9 support",
    ],
  },
  {
    icon: RefreshCw,
    title: "Real-Time AML Transaction Monitoring",
    description:
      "Every transaction. Every counterparty. Monitored in real time. Hera ingests your on-chain transaction flow and cross-references it against Chainalysis KYT risk data — automatically flagging exposure to sanctioned entities, high-risk clusters, mixers, and suspicious patterns before they become regulatory problems.",
    bullets: [
      "Live transaction monitoring across all supported networks",
      "Chainalysis KYT data fusion for institutional-grade risk scoring",
      "Automated rule engine: velocity checks, structuring detection, Travel Rule gaps",
      "Real-time alerts with full evidence trail",
    ],
  },
  {
    icon: FileText,
    title: "Audit-Ready Compliance Reports",
    description:
      "Regulator-ready documentation, generated automatically. Every compliance event in Hera produces a digitally signed, tamper-evident audit record. When regulators, exchanges, or investors ask for documentation — it's already done.",
    bullets: [
      "Signed JSON manifests and PDF compliance reports",
      "Full transaction provenance with evidence references",
      "SAR-ready export formats",
      "MiCA technical documentation support",
    ],
  },
  {
    icon: Star,
    title: "Stellar-Native Compliance",
    tag: "Core Differentiator",
    description:
      "Built from the ground up for Stellar — not bolted on. Hera is the only compliance platform that handles Stellar's unique account architecture natively. We resolve all three Stellar account forms — standard G... addresses, muxed M... accounts, and G... + memo pairs — correctly mapping sub-accounts to individual customer records. No other compliance platform does this.",
    bullets: [
      "SEP-10 — cryptographic account authentication before any KYC is collected",
      "SEP-12 — standardised KYC data submission and verification",
      "SEP-8 — pre-settlement transaction approval enforcement (coming Stage 3)",
    ],
    note: "For institutions issuing tokenised assets on Stellar, operating as Anchors, or running cross-border payment corridors — Hera is the compliance infrastructure your ecosystem was missing.",
  },
];

// ---------------------------------------------------------------------------
// Section 6 — Pricing
// ---------------------------------------------------------------------------

interface PricingCard {
  name: string;
  price: string | null;
  priceNote: string;
  featured: boolean;
  badgeLabel?: string;
  features: { text: string; type: "check" | "cross" | "star" }[];
  validity: string;
  stellar?: boolean;
}

const evmPlans: PricingCard[] = [
  {
    name: "Starter",
    price: "200",
    priceNote: "/ one-time",
    featured: false,
    features: [
      { text: "1-3 wallet addresses", type: "check" },
      { text: "OFAC, EU & UN sanctions screening", type: "check" },
      { text: "Transaction risk scoring", type: "check" },
      { text: "Digitally signed PDF", type: "check" },
      { text: "Delivered in 5-7 business days", type: "check" },
      { text: "Fund flow analysis", type: "cross" },
      { text: "Counterparty exposure", type: "cross" },
    ],
    validity: "Valid 90 days from issue",
  },
  {
    name: "Standard",
    price: null,
    priceNote: "Quoted based on scope",
    featured: true,
    badgeLabel: "Most popular",
    features: [
      { text: "4-5 wallet addresses", type: "check" },
      { text: "OFAC, EU & UN sanctions screening", type: "check" },
      { text: "Full transaction risk analysis", type: "check" },
      { text: "Fund flow analysis & diagram", type: "check" },
      { text: "Counterparty exposure assessment", type: "check" },
      { text: "Digitally signed PDF", type: "check" },
      { text: "Delivered in 5-7 business days", type: "check" },
    ],
    validity: "Valid 90 days from issue",
  },
  {
    name: "Project Pack",
    price: null,
    priceNote: "All team & treasury wallets",
    featured: false,
    features: [
      { text: "All team, treasury & contract wallets", type: "check" },
      { text: "Full sanctions & risk screening", type: "check" },
      { text: "Complete fund flow analysis", type: "check" },
      { text: "Counterparty exposure assessment", type: "check" },
      { text: "Priority delivery", type: "check" },
      { text: "One free re-screen at 90 days", type: "check" },
    ],
    validity: "Valid 90 days — free re-screen included",
  },
  {
    name: "Enterprise",
    price: null,
    priceNote: "Ongoing monitoring & support",
    featured: false,
    features: [
      { text: "Continuous transaction monitoring", type: "check" },
      { text: "Automated monthly reports", type: "check" },
      { text: "Real-time risk alerts", type: "check" },
      { text: "Dedicated compliance support", type: "check" },
      { text: "MiCA documentation support", type: "check" },
    ],
    validity: "Ongoing — no fixed term",
  },
];

const stellarPlans: PricingCard[] = [
  {
    name: "Stellar Standard",
    price: "500",
    priceNote: "/ one-time",
    featured: false,
    stellar: true,
    features: [
      { text: "Single Stellar account", type: "check" },
      { text: "Complete transaction history", type: "check" },
      { text: "Per-transaction KYT risk scoring", type: "check" },
      { text: "Red / Amber / Green classification", type: "check" },
      { text: "OFAC, EU & UN sanctions screening", type: "check" },
      { text: "Digitally signed PDF", type: "check" },
      { text: "Native G..., M... & G+memo resolution", type: "star" },
      { text: "Delivered in 5-7 business days", type: "check" },
    ],
    validity: "Valid 90 days from issue",
  },
  {
    name: "Stellar Project Pack",
    price: null,
    priceNote: "Quoted based on scope",
    featured: true,
    badgeLabel: "Recommended",
    stellar: true,
    features: [
      { text: "Multiple Stellar accounts", type: "check" },
      { text: "Complete transaction history", type: "check" },
      { text: "Full KYT risk scoring", type: "check" },
      { text: "OFAC, EU & UN sanctions screening", type: "check" },
      { text: "Fund flow analysis across accounts", type: "check" },
      { text: "Priority delivery", type: "check" },
      { text: "Native G..., M... & G+memo resolution", type: "star" },
      { text: "One free re-screen at 90 days", type: "check" },
    ],
    validity: "Valid 90 days — free re-screen included",
  },
  {
    name: "Stellar Monthly",
    price: null,
    priceNote: "For Anchors & payment operators",
    featured: false,
    stellar: true,
    features: [
      { text: "Continuous monthly reports", type: "check" },
      { text: "Real-time transaction monitoring", type: "check" },
      { text: "Automated alert notifications", type: "check" },
      { text: "Monthly signed PDF — auto-delivered", type: "check" },
      { text: "Built for Stellar Anchors", type: "star" },
      { text: "Dedicated compliance support", type: "check" },
    ],
    validity: "Ongoing — no fixed term",
  },
  {
    name: "Stellar Enterprise",
    price: null,
    priceNote: "Full KYC/AML infrastructure",
    featured: false,
    stellar: true,
    features: [
      { text: "End-to-end KYC/AML platform", type: "check" },
      { text: "SEP-10 / SEP-12 / SEP-9 native", type: "check" },
      { text: "Real-time AML monitoring", type: "check" },
      { text: "Automated regulator reporting", type: "check" },
      { text: "MiCA documentation support", type: "check" },
      { text: "SEP-8 pre-settlement enforcement", type: "star" },
    ],
    validity: "Ongoing — no fixed term",
  },
];

function PricingCardComponent({ plan }: { plan: PricingCard }) {
  const isStellar = plan.stellar;
  const cardBorder = plan.featured
    ? "border-2 border-primary"
    : isStellar
    ? "border border-blue-400/30"
    : "border border-border";
  const cardBg = isStellar ? "bg-blue-400/5" : "bg-card";

  return (
    <div className={`${cardBorder} ${cardBg} rounded-[12px] p-5 flex flex-col gap-3.5 relative`}>
      {plan.badgeLabel && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[10px] uppercase tracking-wider font-semibold bg-primary text-primary-foreground rounded-full whitespace-nowrap">
          {plan.badgeLabel}
        </span>
      )}
      <p className="text-sm font-semibold text-foreground">{plan.name}</p>
      <div className="min-h-[44px]">
        {plan.price ? (
          <div className="flex items-baseline gap-0.5">
            <span className="text-xs font-semibold text-primary">USD</span>
            <span className="text-3xl font-mono font-medium text-primary">{plan.price}</span>
            <span className="text-xs text-muted-foreground ml-1">{plan.priceNote}</span>
          </div>
        ) : (
          <div className="pt-2">
            <p className="text-sm font-medium text-foreground">Contact us for pricing</p>
            <p className="text-xs text-muted-foreground mt-0.5">{plan.priceNote}</p>
          </div>
        )}
      </div>
      <hr className="border-border" />
      <ul className="flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f.text} className={`flex items-start gap-2 text-xs leading-relaxed ${f.type === "cross" ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
            {f.type === "check" && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />}
            {f.type === "cross" && <span className="w-3.5 h-3.5 shrink-0 mt-0.5 flex items-center justify-center text-muted-foreground/30 text-xs font-bold">&times;</span>}
            {f.type === "star" && <Star className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="w-3 h-3" />
        {plan.validity}
      </div>
      <a
        href="mailto:contact@heralayer.com"
        className={`block text-center py-2.5 rounded-[8px] text-xs font-medium transition-colors ${
          plan.featured
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
        }`}
      >
        Contact us
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 8 — Use Cases
// ---------------------------------------------------------------------------

const useCases = [
  {
    icon: Building2,
    title: "Tokenised Asset Issuers",
    description:
      "Issuing RWAs, stablecoins, or regulated securities on Stellar or EVM? Hera provides the KYC onboarding, AML monitoring, and audit documentation your regulated asset requires — including SEP-8 pre-settlement enforcement.",
  },
  {
    icon: Globe,
    title: "Cross-Border Payment Anchors",
    description:
      "Operating a Stellar Anchor or cross-border payment corridor? Hera handles KYC verification, Travel Rule compliance, and real-time transaction screening — built natively on Stellar's SEP standards.",
  },
  {
    icon: TrendingUp,
    title: "Crypto Exchanges & OTC Desks",
    description:
      "Need institutional-grade AML monitoring and regulator-ready reporting across multiple networks? Hera's data fusion layer gives your compliance team real-time visibility across every transaction.",
  },
  {
    icon: Landmark,
    title: "Institutions Entering Blockchain Markets",
    description:
      "Building your blockchain compliance infrastructure from scratch? Hera is the middleware layer that connects your existing systems to on-chain activity — without rebuilding your compliance stack.",
  },
];

// ---------------------------------------------------------------------------
// Section 10 — Steps
// ---------------------------------------------------------------------------

const steps = [
  {
    step: "01",
    icon: Activity,
    title: "Connect",
    description:
      "Link your operation via API or our web portal in hours. Stellar Anchors, EVM contracts, and multi-chain setups all supported.",
  },
  {
    step: "02",
    icon: Shield,
    title: "Monitor",
    description:
      "Hera ingests your transaction flow in real time, automatically screening every activity against your compliance ruleset and institutional-grade risk intelligence.",
  },
  {
    step: "03",
    icon: Bell,
    title: "Alert",
    description:
      "Your team is notified the moment a risk threshold is triggered — with full evidence trails ready for review.",
  },
  {
    step: "04",
    icon: FileText,
    title: "Report",
    description:
      "Digitally signed, regulator-ready compliance reports generated on demand or automatically on schedule.",
  },
];

// ---------------------------------------------------------------------------
// Networks strip
// ---------------------------------------------------------------------------

const networks = ["Stellar", "Ethereum", "BNB Chain", "Polygon", "Arbitrum", "Base"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* ================================================================ */}
      {/* HERO                                                             */}
      {/* ================================================================ */}
      <section className="relative min-h-screen flex flex-col">
        <HexBackground />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
          <Logo />
          <div className="flex items-center gap-6">
            <a href="#platform" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Platform
            </a>
            <a href="#use-cases" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Use Cases
            </a>
            <a href="#reports" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Reports
            </a>
            <Link to="/security" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Security
            </Link>
            <Link to="/compliance" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Compliance
            </Link>
            <a
              href="https://calendar.app.google/ew98PiFvT5MeBGiL8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-semibold rounded-[6px] hover:bg-primary/90 transition-colors"
            >
              Book a Demo
            </a>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="label-tag mb-4">Institutional Blockchain Compliance</p>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-mono font-bold leading-tight max-w-5xl">
              Compliance Infrastructure for the
              <br />
              <span className="text-primary">Institutional Blockchain Era</span>
            </h1>
            <p className="mt-6 text-muted-foreground max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
              Hera Protocol delivers end-to-end KYC/AML automation — fusing on-chain transaction data with
              Chainalysis KYT intelligence to give institutions real-time compliance visibility, automated
              monitoring, and regulator-ready audit documentation.
            </p>

            {/* Trust badges */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 border border-primary/30 bg-primary/5 rounded-full text-xs font-medium text-primary">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Selected for UNICEF Venture Fund
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 border border-amber-400/30 bg-amber-400/5 rounded-full text-xs font-medium text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                FCA Digital Sandbox — Application in Progress
              </span>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://calendar.app.google/ew98PiFvT5MeBGiL8"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground text-sm uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors text-center"
              >
                Book a Demo
              </a>
              <a
                href="#reports"
                className="w-full sm:w-auto px-8 py-3 border border-border text-sm uppercase tracking-[0.08em] font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors text-center"
              >
                Get a Compliance Report
              </a>
            </div>
          </motion.div>
        </div>

        {/* Networks strip */}
        <div className="relative z-10 border-t border-border py-5 px-6">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {networks.map((n) => (
              <span key={n} className="text-xs font-mono text-muted-foreground tracking-wider uppercase">
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 2 — Positioning                                          */}
      {/* ================================================================ */}
      <section className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-base md:text-lg text-muted-foreground leading-relaxed font-mono"
          >
            Hera is not a blockchain explorer. It is not a data dashboard. It is the{" "}
            <span className="text-foreground font-semibold">compliance middleware layer</span> that
            connects your on-chain activity to the regulatory standards your institution must meet.
          </motion.p>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 3 — The Problem                                          */}
      {/* ================================================================ */}
      <section className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">The Problem</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-4">
            Blockchain compliance is broken for institutions. Here's why.
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {problems.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="border border-border bg-card p-6 hover:border-destructive/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <h3 className="font-mono font-semibold text-sm">{p.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 4 — The Solution                                         */}
      {/* ================================================================ */}
      <section className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">The Solution</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-4">
            One compliance layer. Every network. Real-time.
          </h2>
          <p className="text-muted-foreground max-w-3xl mb-12 leading-relaxed">
            Hera Protocol is a compliance middleware platform that sits between your blockchain operations and your
            regulatory obligations. We ingest raw on-chain transaction data, cross-reference it in real time against
            Chainalysis KYT risk intelligence, apply your compliance ruleset, and produce audit-ready outputs — automatically.
          </p>
          <p className="text-sm text-foreground font-medium mb-12">
            The result: your compliance team spends less time chasing data and more time making decisions.
          </p>

          {/* Visual flow */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-border bg-card overflow-hidden"
          >
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="p-6">
                <p className="label-tag mb-4 text-primary">On-Chain Data</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Stellar transactions</li>
                  <li>Ethereum activity</li>
                  <li>Solana payments</li>
                  <li>Cross-chain flows</li>
                </ul>
              </div>
              <div className="p-6 bg-primary/5">
                <p className="label-tag mb-4 text-primary">Hera Compliance Engine</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>KYC identity verification</li>
                  <li>Chainalysis KYT data fusion</li>
                  <li>Real-time AML rule engine</li>
                  <li>Sanctions screening</li>
                </ul>
              </div>
              <div className="p-6">
                <p className="label-tag mb-4 text-primary">Regulatory Output</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Signed audit reports</li>
                  <li>SAR documentation</li>
                  <li>MiCA compliance docs</li>
                  <li>Exchange listing pack</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 5 — Core Platform                                        */}
      {/* ================================================================ */}
      <section id="platform" className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">Platform</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-16">
            What Hera Does
          </h2>
          <div className="space-y-8">
            {platformFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="border border-border bg-card p-8 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-[6px] flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-mono font-semibold text-base">{f.title}</h3>
                      {f.tag && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium bg-primary/10 text-primary rounded">
                          {f.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{f.description}</p>
                    <ul className="space-y-1.5">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    {f.note && (
                      <p className="mt-4 text-sm text-foreground/80 italic">{f.note}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 6 — Pricing                                              */}
      {/* ================================================================ */}
      <section id="reports" className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">Pricing</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground max-w-2xl mb-12 leading-relaxed">
            Professional compliance reports with no retainer and no long-term contract.
            All reports are digitally signed and valid for 90 days from the date of issue. Contact us to get started.
          </p>

          {/* EVM block label */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-foreground tracking-wide">EVM Chain Reports</span>
            <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-medium bg-muted text-muted-foreground rounded-full">
              Ethereum &middot; Solana &middot; BNB Chain &middot; Polygon &middot; Arbitrum &middot; Base
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* EVM pricing grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {evmPlans.map((plan) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <PricingCardComponent plan={plan} />
              </motion.div>
            ))}
          </div>

          {/* Stellar block label */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-foreground tracking-wide flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-primary" />
              Stellar Native Reports
            </span>
            <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-primary text-primary-foreground rounded-full">
              Market Exclusive
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Stellar explainer */}
          <div className="border border-blue-400/30 bg-blue-400/5 rounded-[10px] px-5 py-3 mb-4 text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-semibold">Why Stellar reports are different:</span>{" "}
            Unlike EVM reports, Stellar reports are generated by Hera's native compliance engine — ingesting data
            directly from the Stellar network, correctly resolving all account forms including muxed M... accounts
            and G+memo sub-accounts. No other compliance platform offers this natively.
          </div>

          {/* Stellar pricing grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {stellarPlans.map((plan) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <PricingCardComponent plan={plan} />
              </motion.div>
            ))}
          </div>

          {/* Enterprise bar */}
          <div className="border border-border rounded-[12px] p-5 flex flex-wrap items-center gap-4 mb-6">
            <div className="w-10 h-10 bg-primary rounded-[8px] flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold text-foreground">Not sure which plan is right for you?</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Contact us and we'll recommend the right report for your needs.
                First-time clients welcome — no commitment required to start a conversation.
              </p>
            </div>
            <a
              href="mailto:contact@heralayer.com"
              className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium rounded-[8px] hover:bg-primary/90 transition-colors shrink-0"
            >
              Get in touch
            </a>
          </div>

          {/* Footnote */}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            All reports cover the complete transaction history of submitted wallet addresses as of the report generation date.
            EVM networks supported: Ethereum, Solana, BNB Chain, Polygon, Arbitrum, Base.
            Stellar reports generated natively via Hera's Stellar compliance engine.
            Rush delivery available on request. Prices quoted in USD.
          </p>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 7 — Why Hera                                             */}
      {/* ================================================================ */}
      <section className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">Differentiation</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-12">
            Why Hera — Not the Alternatives
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-border bg-card overflow-x-auto"
          >
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-4 label-tag">Capability</th>
                  <th className="text-center px-5 py-4 label-tag text-primary">Hera</th>
                  <th className="text-center px-5 py-4 label-tag">Generic AML Tools</th>
                  <th className="text-center px-5 py-4 label-tag">In-House Build</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["Real-time on-chain monitoring", true, "partial", false],
                  ["Chainalysis KYT data fusion", true, true, false],
                  ["Stellar-native account resolution (G.../M.../memo)", true, false, false],
                  ["SEP-10 / SEP-12 / SEP-8 compliance", true, false, "partial"],
                  ["Automated KYC onboarding", true, "partial", false],
                  ["Signed audit-ready PDF reports", true, false, false],
                  ["MiCA documentation support", true, false, false],
                  ["Multi-chain support (EVM + Stellar)", true, true, "partial"],
                  ["Up and running in days", true, true, false],
                ].map(([capability, hera, generic, inHouse], i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 text-foreground text-xs font-mono">{capability as string}</td>
                    <td className="px-5 py-3 text-center">
                      {hera === true && <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />}
                      {hera === "partial" && <span className="text-amber-400 text-xs">Partial</span>}
                      {hera === false && <span className="text-muted-foreground/40 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {generic === true && <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />}
                      {generic === "partial" && <span className="text-amber-400 text-xs">Partial</span>}
                      {generic === false && <span className="text-muted-foreground/40 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {inHouse === true && <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />}
                      {inHouse === "partial" && <span className="text-amber-400 text-xs">Partial</span>}
                      {inHouse === false && <span className="text-muted-foreground/40 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 8 — Use Cases                                            */}
      {/* ================================================================ */}
      <section id="use-cases" className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">Use Cases</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-12">
            Who Uses Hera
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {useCases.map((uc, i) => (
              <motion.div
                key={uc.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="border border-border bg-card p-6 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-[6px] flex items-center justify-center shrink-0">
                    <uc.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-mono font-semibold text-sm mb-2">{uc.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{uc.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 9 — MiCA                                                 */}
      {/* ================================================================ */}
      <section id="mica" className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-amber-400/30 bg-amber-400/5 p-8 md:p-12"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-amber-400" />
              <p className="label-tag text-amber-400">Regulatory Deadline</p>
            </div>
            <h2 className="text-2xl md:text-3xl font-mono font-bold mb-4">
              MiCA Is Here. Is Your Compliance Infrastructure Ready?
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              MiCA is now in full effect across the EU. The grace period for most crypto asset service providers
              ends July 2026 — and regulators are watching.
            </p>
            <p className="text-sm text-foreground font-medium mb-4">Hera supports institutions navigating MiCA compliance with:</p>
            <ul className="space-y-2 mb-8">
              {[
                "KYC/AML infrastructure aligned to MiCA's CASP requirements",
                "Travel Rule compliance for cross-border transactions",
                "Audit-ready documentation formatted for regulatory submission",
                "Technical documentation support for MiCA licensing applications",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://calendar.app.google/ew98PiFvT5MeBGiL8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium hover:bg-primary/90 transition-colors"
            >
              Talk to Us About MiCA
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 10 — How It Works                                        */}
      {/* ================================================================ */}
      <section className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3 text-center">Process</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-16 text-center">
            Up and running in days, not months
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="border border-border bg-card p-6 text-center hover:border-primary/30 transition-colors"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-mono text-primary mb-2 block">{s.step}</span>
                <h3 className="font-mono font-semibold text-sm mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 11 — CTA Banner                                          */}
      {/* ================================================================ */}
      <section className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="label-tag mb-4">Get Started</p>
            <h2 className="text-2xl md:text-4xl font-mono font-bold mb-4">
              The compliance deadline is not moving.
              <br />
              Your infrastructure should be.
            </h2>
            <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
              Whether you need a compliance report this week or a full institutional compliance
              platform — Hera is built for both.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://calendar.app.google/ew98PiFvT5MeBGiL8"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-primary text-primary-foreground text-sm uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
              >
                Book a Demo
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#reports"
                className="px-8 py-3 border border-border text-sm uppercase tracking-[0.08em] font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors text-center"
              >
                Get a Compliance Report
              </a>
              <a
                href="mailto:contact@heralayer.com"
                className="px-8 py-3 border border-border text-sm uppercase tracking-[0.08em] font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors text-center"
              >
                Contact Us
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 12 — Footer                                              */}
      {/* ================================================================ */}
      <footer className="border-t border-border py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            {/* Brand */}
            <div>
              <Logo />
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                Institutional-Grade Blockchain Compliance Infrastructure
              </p>
            </div>

            {/* Services */}
            <div>
              <p className="label-tag mb-4">Services</p>
              <ul className="space-y-2">
                {["KYC Automation", "AML Monitoring", "Compliance Reports", "MiCA Documentation", "Audit Reports"].map((item) => (
                  <li key={item}>
                    <a href="#platform" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Networks */}
            <div>
              <p className="label-tag mb-4">Networks</p>
              <ul className="space-y-2">
                {["Stellar", "Ethereum", "Solana", "BNB Chain", "Polygon", "Arbitrum", "Base"].map((item) => (
                  <li key={item}>
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <p className="label-tag mb-4">Resources</p>
              <ul className="space-y-2">
                <li>
                  <Link to="/security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Security</Link>
                </li>
                <li>
                  <Link to="/compliance" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Compliance</Link>
                </li>
                <li>
                  <Link to="/documentation" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="label-tag mb-4">Company</p>
              <ul className="space-y-2">
                <li>
                  <Link to="/request-access" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
                </li>
                <li>
                  <a href="mailto:contact@heralayer.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
                </li>
                <li>
                  <a href="https://calendar.app.google/ew98PiFvT5MeBGiL8" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Book a Demo</a>
                </li>
              </ul>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">HERA PROTOCOL LIMITED</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                  167-169, Great Portland Street, 5th Floor,<br />
                  London, England, W1W 5PF
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Company number: 17324991</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <a href="mailto:contact@heralayer.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="w-3.5 h-3.5" />
              contact@heralayer.com
            </a>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Hera Protocol Limited. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
