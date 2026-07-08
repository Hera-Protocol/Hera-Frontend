import { HexBackground } from "@/components/HexBackground";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  CheckCircle2,
  Clock,
  Globe,
  Scale,
  Mail,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "react-router-dom";

const standards = [
  {
    name: "FATF",
    description: "AML rule engine follows the FATF 40 Recommendations",
  },
  {
    name: "OFAC",
    description: "Every address screened against the US Treasury SDN list",
  },
  {
    name: "EU Sanctions",
    description: "Full EU Consolidated Sanctions List screening",
  },
  {
    name: "UN Sanctions",
    description: "Screening aligned with UN Security Council lists",
  },
];

const Compliance = () => {
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
              <Scale className="w-7 h-7 text-primary" />
            </div>
            <p className="label-tag mb-4">Compliance / Trust Center</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-mono font-bold leading-tight max-w-4xl mx-auto">
              Built on Globally
              <br />
              <span className="text-primary">Recognised Standards</span>
            </h1>
            <p className="mt-6 text-muted-foreground max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
              Our compliance engine is aligned with the standards regulators and institutions already trust.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Standards Grid */}
      <section className="py-24 px-6 md:px-12 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">Regulatory Alignment</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-12">
            Standards We Screen Against
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {standards.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="border border-border bg-card p-6 text-center hover:border-primary/30 transition-colors"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-mono font-bold text-lg text-foreground mb-2">{s.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MiCA Callout */}
      <section className="py-16 px-6 md:px-12 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-primary/30 bg-primary/5 p-8 md:p-12"
          >
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-primary" />
              <p className="label-tag text-primary">MiCA-Ready Architecture</p>
            </div>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Built on globally recognised standards (FATF, OFAC, UN, EU), with jurisdiction-specific
              configuration for <span className="text-foreground font-medium">MiCA, FCA, MAS, FinCEN</span> and
              beyond. One infrastructure, every regulated market.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FCA Status */}
      <section className="py-16 px-6 md:px-12 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <p className="label-tag mb-3">Regulatory Status</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-8">
            Where We Are
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-amber-400/30 bg-amber-400/5 p-6 md:p-8 flex items-start gap-4"
          >
            <div className="w-10 h-10 bg-amber-400/10 rounded-full flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-mono font-semibold text-base mb-1">FCA Digital Sandbox</h3>
              <p className="text-sm text-amber-400 font-medium">Application in progress</p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                We are currently applying to the FCA Digital Sandbox to further validate and refine
                our compliance infrastructure within a regulated testing environment.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-primary/30 bg-primary/5 p-6 md:p-8 flex items-start gap-4 mt-4"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-mono font-semibold text-base mb-1">UNICEF Venture Fund</h3>
              <p className="text-sm text-primary font-medium">Selected</p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Hera Protocol has been selected for the UNICEF Venture Fund, recognising our
                approach to building open, scalable compliance infrastructure.
              </p>
            </div>
          </motion.div>
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
              Questions About Compliance?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Our team can walk you through how Hera aligns with your regulatory requirements.
            </p>
            <a
              href="https://calendar.app.google/ew98PiFvT5MeBGiL8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium hover:bg-primary/90 transition-colors"
            >
              Book a Call
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="px-6 md:px-12 pb-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
            Hera Protocol is a compliance technology provider, not a licensed financial institution or law firm.
            Regulatory responsibility remains with clients and their legal/compliance teams.
          </p>
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

export default Compliance;
