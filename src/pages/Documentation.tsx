import { HexBackground } from "@/components/HexBackground";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Code,
  Server,
  Shield,
  Workflow,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "react-router-dom";

const docSections = [
  {
    icon: Code,
    title: "API Reference",
    description:
      "Complete REST API documentation for integrating Hera's compliance engine into your existing infrastructure. Authenticate, submit wallets, trigger screenings, and retrieve reports programmatically.",
    status: "Available on request",
  },
  {
    icon: Workflow,
    title: "Integration Guides",
    description:
      "Step-by-step guides for connecting Hera to your blockchain operations — including Stellar Anchor setup, EVM wallet monitoring, and webhook configuration for real-time alerts.",
    status: "Available on request",
  },
  {
    icon: FileText,
    title: "Compliance Report Specifications",
    description:
      "Detailed documentation on Hera's compliance report format — including digitally signed PDF structure, JSON manifest schema, evidence references, and SAR-ready export formats.",
    status: "Available on request",
  },
  {
    icon: Shield,
    title: "Security & Data Handling",
    description:
      "Technical documentation covering our encryption standards, data minimisation practices, access control architecture, and audit logging infrastructure.",
    status: "Available",
    link: "/security",
  },
  {
    icon: Server,
    title: "Stellar SEP Implementation",
    description:
      "Native implementation guides for SEP-10 (authentication), SEP-12 (KYC data submission), SEP-9 (standard KYC fields), and SEP-8 (pre-settlement transaction approval).",
    status: "Available on request",
  },
  {
    icon: BookOpen,
    title: "Regulatory Framework Guides",
    description:
      "Reference documentation for the regulatory frameworks Hera supports — including MiCA, FATF 40 Recommendations, Travel Rule requirements, and jurisdiction-specific configurations.",
    status: "Available",
    link: "/compliance",
  },
];

const Documentation = () => {
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

        {/* Hero */}
        <div className="relative z-10 px-6 md:px-12 py-20 md:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-14 h-14 bg-primary/10 rounded-[10px] flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
            <p className="label-tag mb-4">Documentation</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-mono font-bold leading-tight max-w-4xl mx-auto">
              Technical
              <br />
              <span className="text-primary">Documentation</span>
            </h1>
            <p className="mt-6 text-muted-foreground max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
              Everything you need to integrate, configure, and operate Hera Protocol's compliance infrastructure.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Doc Sections */}
      <section className="py-24 px-6 md:px-12 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {docSections.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="border border-border bg-card p-6 hover:border-primary/30 transition-colors flex flex-col"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-10 h-10 bg-primary/10 rounded-[6px] flex items-center justify-center shrink-0">
                    <s.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-mono font-semibold text-sm mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-primary" />
                    {s.status}
                  </span>
                  {s.link ? (
                    <Link
                      to={s.link}
                      className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      View &rarr;
                    </Link>
                  ) : (
                    <a
                      href="mailto:contact@heralayer.com"
                      className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      Request Access &rarr;
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 md:px-12 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-mono font-bold mb-4">
              Need Technical Documentation?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Full API documentation and integration guides are available on request.
              Contact us to get access.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:contact@heralayer.com"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium hover:bg-primary/90 transition-colors"
              >
                Request Documentation
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://calendar.app.google/ew98PiFvT5MeBGiL8"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-border text-xs uppercase tracking-[0.1em] font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
              >
                Book a Technical Demo
              </a>
            </div>
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

export default Documentation;
