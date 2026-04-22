import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Lock, FileCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { HexBackground } from "@/components/HexBackground";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const orgTypes = [
  "Compliance / RegTech",
  "Auditor / Accounting Firm",
  "Exchange / Custodian",
  "Foundation / Protocol Team",
  "Law Enforcement / Government",
  "Other",
];

const chainOptions = ["Zcash", "Namada", "Both"];

const useCases = [
  "Travel Rule compliance",
  "Internal treasury audit",
  "Regulator reporting",
  "Investigations / forensics",
  "Tax reporting",
  "Other",
];

const trustBullets = [
  { icon: Lock, text: "Viewing keys never leave your workspace unencrypted" },
  { icon: ShieldCheck, text: "SOC 2 controls and tamper-evident audit logs" },
  { icon: FileCheck, text: "Cryptographically signed reports, ready for regulators" },
];

const RequestAccess = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    workEmail: "",
    organization: "",
    role: "",
    orgType: "",
    chain: "",
    useCase: "",
    volume: "",
    notes: "",
  });

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const required = ["fullName", "workEmail", "organization", "orgType", "chain"] as const;
  const missing = required.some((k) => !form[k].trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (missing) {
      toast.error("Please complete all required fields.");
      return;
    }
    // Basic email check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail)) {
      toast.error("Please enter a valid work email.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      toast.success("Request received. The Hera team will be in touch.");
    }, 700);
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <HexBackground />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6 border-b border-border">
        <Link to="/">
          <Logo />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 py-12 md:py-20">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
          {/* Left: context */}
          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:sticky lg:top-12 lg:self-start"
          >
            <p className="label-tag mb-4">Private Beta</p>
            <h1 className="text-3xl md:text-4xl font-mono font-bold leading-tight mb-4">
              Request access to <span className="text-primary">Hera Protocol</span>
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-8 text-sm md:text-base">
              Hera is currently onboarding a small group of compliance teams, auditors, and
              regulated entities working with Zcash and Namada. Tell us a bit about your
              workspace and we'll respond within two business days.
            </p>

            <div className="space-y-3 mb-8">
              {trustBullets.map((b) => (
                <div key={b.text} className="flex gap-3 items-start">
                  <b.icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.text}</p>
                </div>
              ))}
            </div>

            <div className="border border-border bg-card p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Already have credentials?
              </p>
              <Link
                to="/login"
                className="text-sm font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                Sign in to your workspace
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.aside>

          {/* Right: form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="border border-border bg-card p-6 md:p-8"
          >
            {submitted ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="text-xl font-mono font-bold mb-2">Request received</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
                  Thanks, {form.fullName.split(" ")[0] || "there"}. A member of the Hera team
                  will reach out to{" "}
                  <span className="font-mono text-foreground">{form.workEmail}</span> shortly.
                </p>
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-6">
                  Reference ID · req_{Math.random().toString(36).slice(2, 10)}
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="px-6 py-2.5 border border-border text-xs uppercase tracking-[0.1em] hover:border-primary/50 hover:text-primary transition-colors"
                >
                  Back to home
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    Section 01
                  </p>
                  <h2 className="text-base font-mono font-semibold mb-4">Contact</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Full name" required>
                      <Input
                        value={form.fullName}
                        onChange={(e) => update("fullName", e.target.value)}
                        placeholder="Jane Doe"
                        maxLength={100}
                      />
                    </Field>
                    <Field label="Work email" required>
                      <Input
                        type="email"
                        value={form.workEmail}
                        onChange={(e) => update("workEmail", e.target.value)}
                        placeholder="jane@firm.com"
                        maxLength={255}
                      />
                    </Field>
                    <Field label="Organization" required>
                      <Input
                        value={form.organization}
                        onChange={(e) => update("organization", e.target.value)}
                        placeholder="Acme Compliance LLC"
                        maxLength={120}
                      />
                    </Field>
                    <Field label="Role / title">
                      <Input
                        value={form.role}
                        onChange={(e) => update("role", e.target.value)}
                        placeholder="Head of Compliance"
                        maxLength={120}
                      />
                    </Field>
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    Section 02
                  </p>
                  <h2 className="text-base font-mono font-semibold mb-4">Workspace</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Organization type" required>
                      <Select value={form.orgType} onValueChange={(v) => update("orgType", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {orgTypes.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Primary chain" required>
                      <Select value={form.chain} onValueChange={(v) => update("chain", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Zcash / Namada" />
                        </SelectTrigger>
                        <SelectContent>
                          {chainOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Primary use case">
                      <Select value={form.useCase} onValueChange={(v) => update("useCase", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select use case" />
                        </SelectTrigger>
                        <SelectContent>
                          {useCases.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Expected monthly scans">
                      <Input
                        value={form.volume}
                        onChange={(e) => update("volume", e.target.value)}
                        placeholder="e.g. 50–200"
                        maxLength={40}
                      />
                    </Field>
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    Section 03
                  </p>
                  <h2 className="text-base font-mono font-semibold mb-4">Context</h2>
                  <Field label="Anything else we should know?">
                    <Textarea
                      value={form.notes}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Specific compliance regime, jurisdiction, timelines…"
                      rows={4}
                      maxLength={1000}
                    />
                  </Field>
                </div>

                <div className="border-t border-border pt-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xs">
                    By submitting, you agree to be contacted about Hera Protocol. We do not
                    share your information.
                  </p>
                  <button
                    type="submit"
                    disabled={loading || missing}
                    className="px-8 py-3 bg-primary text-primary-foreground text-xs uppercase tracking-[0.1em] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {loading ? "Submitting…" : "Submit request"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default RequestAccess;
