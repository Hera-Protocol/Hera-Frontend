import { HexBackground } from "@/components/HexBackground";
import { motion } from "framer-motion";
import { Eye, Link as LinkIcon, FileCheck, Lock, Fingerprint, ShieldCheck, Zap, ArrowRight, Terminal } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Eye,
    title: "View Without Spending",
    description: "Decrypt shielded transaction data using viewing keys — no spending authority required. Full read access, zero custody risk.",
  },
  {
    icon: LinkIcon,
    title: "Chain-Native Scanning",
    description: "Direct protocol integration with Zcash and Namada for full-fidelity transaction reconstruction. No third-party indexers.",
  },
  {
    icon: FileCheck,
    title: "Audit-Ready Reports",
    description: "Cryptographically signed compliance reports with verifiable chain-of-custody proofs. Export JSON or PDF.",
  },
];

const howItWorks = [
  { step: "01", title: "Import Viewing Key", description: "Securely submit an encrypted viewing key. Hera never stores raw cryptographic material." },
  { step: "02", title: "Chain Sync & Scan", description: "Hera connects directly to the chain, syncs blocks, and detects shielded notes tied to your key." },
  { step: "03", title: "Classify Flows", description: "Transactions are categorized — SEND, RECEIVE, SHIELD, UNSHIELD — with cryptographic ownership proofs." },
  { step: "04", title: "Generate Report", description: "A tamper-evident, SHA-256 signed compliance report is produced. Ready for regulators." },
];

const stats = [
  { value: "2M+", label: "Shielded transactions analyzed" },
  { value: "<5min", label: "Average scan completion" },
  { value: "100%", label: "Cryptographic proof coverage" },
  { value: "0", label: "Raw keys stored" },
];

const principles = [
  { icon: Lock, title: "Zero-Knowledge Compatible", description: "Designed around ZK proof systems. Compliance without compromising the privacy guarantees of the underlying protocol." },
  { icon: Fingerprint, title: "Minimal Disclosure", description: "Reports reveal only what regulators need. No unnecessary data exposure. Selective disclosure by design." },
  { icon: ShieldCheck, title: "Tamper-Evident Outputs", description: "Every report is SHA-256 hashed and signed. Any modification is immediately detectable." },
  { icon: Zap, title: "Real-Time Monitoring", description: "Continuous scanning mode for ongoing compliance. Get notified when new shielded activity is detected." },
];

const faqs = [
  { q: "Does Hera have access to spending keys?", a: "Never. Hera operates exclusively with viewing keys, which provide read-only access to shielded transaction data. No funds can ever be moved." },
  { q: "Which chains are supported?", a: "Hera currently supports Zcash (Sapling and Orchard shielded pools) and Namada (MASP). Additional privacy-preserving chains are on the roadmap." },
  { q: "How are reports verified?", a: "Each report includes a SHA-256 hash of its contents. The hash is computed at generation time and can be independently verified by any party." },
  { q: "Is Hera suitable for institutional use?", a: "Yes. Hera is built for compliance teams, auditors, and regulated entities. Audit logging, role-based access, and workspace isolation are core features." },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col">
        <HexBackground />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
          <Logo />
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              How It Works
            </a>
            <a href="#principles" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Principles
            </a>
            <a href="#faq" className="text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              FAQ
            </a>
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-semibold rounded-[6px] hover:bg-primary/90 transition-colors"
            >
              Launch App
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="label-tag mb-4">Privacy-Compliance Infrastructure</p>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-mono font-bold leading-tight max-w-4xl">
              Compliance for the
              <br />
              <span className="text-primary">shielded world.</span>
            </h1>
            <p className="mt-6 text-muted-foreground max-w-xl mx-auto text-base md:text-lg leading-relaxed">
              Regulatory-grade transaction analysis for privacy-preserving blockchains.
              Zero-knowledge proof compatible. Audit-ready.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/request-access"
                className="w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground text-sm uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors text-center"
              >
                Request Early Access
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-8 py-3 border border-border text-sm uppercase tracking-[0.08em] font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors text-center"
              >
                Learn More
              </a>
            </div>
          </motion.div>
        </div>

        {/* Trust strip */}
        <div className="relative z-10 border-t border-border py-6 px-6 text-center">
          <p className="text-xs text-muted-foreground tracking-wide font-mono">
            Built for Zcash. Built for Namada. Built for regulators who need answers.
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="px-6 py-8 text-center border-r border-border last:border-r-0"
            >
              <p className="text-2xl md:text-3xl font-mono font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">Capabilities</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-4">
            Purpose-built for shielded chains
          </h2>
          <p className="text-muted-foreground max-w-2xl mb-16">
            Traditional blockchain analytics tools cannot see inside shielded pools. Hera uses viewing keys and protocol-level integration to reconstruct transaction histories without compromising user privacy.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="border border-border bg-card p-6 group hover:border-primary/30 transition-colors"
              >
                <f.icon className="w-5 h-5 text-primary mb-4" />
                <h3 className="font-mono font-semibold text-sm mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">Process</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-16">
            How Hera works
          </h2>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
            {howItWorks.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="flex gap-5"
              >
                <span className="text-3xl font-mono font-bold text-primary/20 shrink-0">{item.step}</span>
                <div>
                  <h3 className="font-mono font-semibold text-sm mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Terminal Preview */}
      <section className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <p className="label-tag mb-3 text-center">Live Output</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-12 text-center">
            Scan output preview
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-mono text-muted-foreground">hera scan --chain zcash --key zxviews1q0...f8a2</span>
            </div>
            <div className="p-5 font-mono text-xs leading-6 text-muted-foreground">
              <p><span className="text-primary">[OK]</span> Key validated against Zcash Sapling parameters</p>
              <p><span className="text-primary">[OK]</span> Chain sync initiated — block range 2,100,000 to 2,146,301</p>
              <p><span className="text-secondary">[..]</span> Syncing blocks... <span className="text-foreground">46,301 / 46,301</span></p>
              <p><span className="text-primary">[OK]</span> Detected <span className="text-foreground">5</span> shielded notes across <span className="text-foreground">3</span> transactions</p>
              <p><span className="text-primary">[OK]</span> Flow classification complete — RECEIVE: 1, SEND: 2, SHIELD: 1, UNSHIELD: 1</p>
              <p><span className="text-primary">[OK]</span> Report generated — <span className="text-foreground">sha256:e3b0c442...b855</span></p>
              <p><span className="text-primary">[OK]</span> Report signed with workspace key</p>
              <p className="mt-2 text-foreground">Scan complete. 5 events detected. Report ready for export.<span className="blink">_</span></p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Principles */}
      <section id="principles" className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3">Principles</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-4">
            Security-first architecture
          </h2>
          <p className="text-muted-foreground max-w-2xl mb-16">
            Hera is designed for environments where cryptographic guarantees matter. Every design decision prioritizes security, minimal disclosure, and verifiability.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {principles.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 border border-border bg-card p-5 hover:border-primary/20 transition-colors"
              >
                <p.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-mono font-semibold text-sm mb-1.5">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Chain Support */}
      <section className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="label-tag mb-3 text-center">Supported Chains</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-12 text-center">
            Protocol-level integration
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="border border-border bg-card p-8"
            >
              <div className="w-10 h-10 rounded-full bg-zcash/10 flex items-center justify-center mb-4">
                <span className="font-mono font-bold text-zcash text-sm">Z</span>
              </div>
              <h3 className="font-mono font-semibold mb-2">Zcash</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Full support for Sapling and Orchard shielded pools. Viewing key decryption of incoming and outgoing notes with complete memo field access.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Sapling", "Orchard", "Transparent", "Memo Fields"].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium bg-zcash/10 text-zcash">{tag}</span>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="border border-border bg-card p-8"
            >
              <div className="w-10 h-10 rounded-full bg-namada/10 flex items-center justify-center mb-4">
                <span className="font-mono font-bold text-namada text-sm">N</span>
              </div>
              <h3 className="font-mono font-semibold mb-2">Namada</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Multi-Asset Shielded Pool (MASP) support. Cross-chain shielded transfers with IBC bridge tracking and multi-asset flow classification.
              </p>
              <div className="flex flex-wrap gap-2">
                {["MASP", "IBC Bridge", "Multi-Asset", "Shielded Transfers"].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium bg-namada/10 text-namada">{tag}</span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <p className="label-tag mb-3">FAQ</p>
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-12">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-border">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="py-6"
              >
                <h3 className="font-mono font-semibold text-sm mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 md:px-12 border-b border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="label-tag mb-4">Get Started</p>
            <h2 className="text-2xl md:text-4xl font-mono font-bold mb-4">
              Ready to bring compliance<br />to the shielded world?
            </h2>
            <p className="text-muted-foreground mb-10 max-w-lg mx-auto">
              Hera is currently in private beta. Request access to start building audit-ready compliance workflows for Zcash and Namada.
            </p>
            <button className="px-10 py-3 bg-primary text-primary-foreground text-sm uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
              Request Early Access
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size={20} />
          <p className="text-xs text-muted-foreground text-center">
            Privacy-compliance infrastructure for the shielded web.
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Hera
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
