import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info } from "lucide-react";
import type { Chain } from "@/data/mock";

const NewCase = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [chain, setChain] = useState<Chain | null>(null);
  const [viewingKey, setViewingKey] = useState("");
  const [birthday, setBirthday] = useState("");
  const [network, setNetwork] = useState<"Mainnet" | "Testnet">("Mainnet");

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-mono font-bold">New Case</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Step {step} of 3
          </p>
          {/* Step indicator */}
          <div className="flex gap-1 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-0.5 flex-1 ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="font-mono font-semibold">Select Chain</h2>
              <div className="grid grid-cols-2 gap-4">
                {(["Zcash", "Namada"] as Chain[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setChain(c)}
                    className={`border p-6 text-left transition-all ${
                      chain === c
                        ? "border-primary shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full mb-3 ${
                        c === "Zcash" ? "bg-zcash/20" : "bg-namada/20"
                      }`}
                    />
                    <h3 className="font-mono font-semibold text-sm">{c}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c === "Zcash"
                        ? "Privacy-focused cryptocurrency with shielded transactions"
                        : "Multi-chain privacy layer with MASP support"}
                    </p>
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-4">
                <button
                  disabled={!chain}
                  onClick={next}
                  className="px-6 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="font-mono font-semibold">Import Viewing Key</h2>

              {/* Warning */}
              <div className="flex items-start gap-3 border border-primary/30 bg-primary/5 p-4">
                <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-primary/90 leading-relaxed">
                  Your viewing key is encrypted immediately on submission. Hera never stores raw keys.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label-tag block mb-2">Viewing Key</label>
                  <textarea
                    value={viewingKey}
                    onChange={(e) => setViewingKey(e.target.value)}
                    placeholder="zxviews1q0..."
                    rows={4}
                    className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-tag block mb-2 flex items-center gap-1">
                      Birthday Height
                      <span className="relative group">
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-card border border-border text-xs text-foreground w-48 hidden group-hover:block">
                          The block height when this key was first created. Speeds up scanning.
                        </span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                    />
                  </div>
                  <div>
                    <label className="label-tag block mb-2">Network</label>
                    <select
                      value={network}
                      onChange={(e) => setNetwork(e.target.value as "Mainnet" | "Testnet")}
                      className="w-full bg-muted border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option>Mainnet</option>
                      <option>Testnet</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={back}
                  className="px-6 py-2 border border-border text-xs uppercase tracking-[0.08em] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back
                </button>
                <button
                  disabled={!viewingKey}
                  onClick={next}
                  className="px-6 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="font-mono font-semibold">Review & Start Scan</h2>

              <div className="border border-border bg-card divide-y divide-border">
                <div className="flex justify-between px-4 py-3">
                  <span className="label-tag">Chain</span>
                  <span className="text-sm font-mono">{chain}</span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="label-tag">Viewing Key</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    {viewingKey.slice(0, 16)}...
                  </span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="label-tag">Birthday Height</span>
                  <span className="text-sm font-mono">{birthday || "None"}</span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="label-tag">Network</span>
                  <span className="text-sm font-mono">{network}</span>
                </div>
              </div>

              <div className="border border-secondary/30 bg-secondary/5 p-4">
                <p className="text-xs text-secondary font-mono">
                  Typical scan: 2-8 minutes
                </p>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={back}
                  className="px-6 py-2 border border-border text-xs uppercase tracking-[0.08em] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => navigate("/dashboard/case/CASE-7f3a8b2c")}
                  className="px-8 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors"
                >
                  Start Compliance Scan
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default NewCase;
