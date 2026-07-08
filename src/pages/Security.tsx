import { HexBackground } from "@/components/HexBackground";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Lock,
  Eye,
  Server,
  Users,
  KeyRound,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "react-router-dom";

const securitySections = [
  {
    icon: KeyRound,
    title: "No Private Key Access",
    description:
      "We only require wallet addresses — public identifiers that are already visible on the blockchain. Hera never requests, stores, or has access to private keys. We never custody funds. Your assets remain entirely under your control at all times.",
    bullets: [
      "Only public wallet addresses required",
      "No private keys requested or stored",
      "No custody of client funds — ever",
      "Read-only access to publicly available on-chain data",
    ],
  },
  {
    icon: Lock,
    title: "Encryption",
    description:
      "All data is encrypted at rest using AES-256 and in transit using TLS 1.3. API keys and credentials are stored in an encrypted secrets vault with hardware-backed key management.",
    bullets: [
      "AES-256 encryption at rest",
      "TLS 1.3 encryption in transit",
      "API keys stored in encrypted secrets vault",
      "Hardware-backed key management",
    ],
  },
  {
    icon: Eye,
    title: "Data Minimisation",
    description:
      "We only read publicly available on-chain data. Any personally identifiable information (PII) collected during KYC processes is encrypted immediately on receipt and stored with strict access controls.",
    bullets: [
      "Only publicly available on-chain data is read",
      "PII (KYC data) encrypted immediately on receipt",
      "Minimal data collection — only what compliance requires",
      "Strict data retention policies",
    ],
  },
  {
    icon: Server,
    title: "No Shared Infrastructure",
    description:
      "Each client gets isolated processing environments. There is no data co-mingling between clients. Your compliance data is fully segregated from every other organisation on the platform.",
    bullets: [
      "Isolated processing per client",
      "No data co-mingling between organisations",
      "Dedicated compliance environments",
      "Full infrastructure segregation",
    ],
  },
  {
    icon: Users,
    title: "Access Control",
    description:
      "Role-based access control ensures only authorised personnel can access sensitive data. Every action on the platform is logged in a full audit trail for complete transparency and accountability.",
    bullets: [
      "Role-based access control (RBAC)",
      "Full audit logs for every action",
      "Multi-factor authentication support",
      "Principle of least privilege enforced",
    ],
  },
];

const Security = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Nav */}
      <section className="relative">
        <HexBackground />
        <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/compliance" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Compliance
            </Link>
            <Link to="/documentation" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Documentation
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

        {/* Hero */}
        <div className="relative z-10 px-6 md:px-12 py-20 md:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-14 h-14 bg-primary/10 rounded-[10px] flex items-center justify-center mx-auto mb-6">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <p className="label-tag mb-4">Security</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-mono font-bold leading-tight max-w-4xl mx-auto">
              Your Data Security Is
              <br />
              <span className="text-primary">Non-Negotiable</span>
            </h1>
            <p className="mt-6 text-muted-foreground max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
              Hera Protocol is built from the ground up with institutional-grade security.
              We never touch private keys, never custody funds, and encrypt everything — at rest and in transit.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Security Sections */}
      <section className="py-24 px-6 md:px-12 border-t border-border">
        <div className="max-w-5xl mx-auto space-y-8">
          {securitySections.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-border bg-card p-8 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-[6px] flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-mono font-semibold text-base mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.description}</p>
                  <ul className="space-y-1.5">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Summary Box */}
      <section className="py-16 px-6 md:px-12 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-primary/30 bg-primary/5 p-8 md:p-12 text-center"
          >
            <Shield className="w-8 h-8 text-primary mx-auto mb-4" />
            <h2 className="text-xl md:text-2xl font-mono font-bold mb-4">
              Security by Design, Not by Afterthought
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
              Every layer of the Hera Protocol stack is built with security as a first principle.
              From isolated client environments to encrypted secrets vaults, we ensure your compliance
              data is protected to the highest standard.
            </p>
            <a
              href="https://calendar.app.google/ew98PiFvT5MeBGiL8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium hover:bg-primary/90 transition-colors"
            >
              Talk to Us About Security
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/">
            <Logo />
          </Link>
          <a href="mailto:contact@heralayer.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Mail className="w-3.5 h-3.5" />
            contact@heralayer.com
          </a>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Hera Protocol Limited. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Security;
