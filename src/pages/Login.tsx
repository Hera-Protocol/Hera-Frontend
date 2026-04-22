import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Lock, Globe, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { useHeraConfig } from "@/lib/hera-config";

const Login = () => {
  const navigate = useNavigate();
  const { apiBaseUrl, apiKey, updateConnection } = useHeraConfig();
  const [baseUrl, setBaseUrl] = useState(apiBaseUrl);
  const [token, setToken] = useState(apiKey);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseUrl || !token) return;
    setLoading(true);
    setTimeout(() => {
      updateConnection({ apiBaseUrl: baseUrl, apiKey: token });
      toast("Backend connection saved.");
      navigate("/dashboard");
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="px-6 md:px-12 py-6">
        <Link to="/">
          <Logo />
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="border border-border bg-card p-8 space-y-6">
            <div className="space-y-2">
              <p className="label-tag text-primary">Compliance Portal</p>
              <h1 className="text-2xl font-mono font-bold">Connect to Hera API</h1>
              <p className="text-sm text-muted-foreground">
                Stage 1 authenticates with a bearer API key, not email/password sessions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-tag block mb-2">API Base URL</label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://127.0.0.1:3000"
                    className="w-full bg-muted border border-border pl-9 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-tag">Bearer API Key</label>
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <textarea
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste a tenant API key"
                    rows={4}
                    className="w-full bg-muted border border-border pl-9 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !baseUrl || !token}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? "Connecting..." : "Open Dashboard"}
                {!loading && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Need access?{" "}
                <Link to="/" className="text-primary hover:text-primary/80">
                  Request early access
                </Link>
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-6 font-mono">
            Protected by SOC 2 · ISO 27001 · session_id: {Math.random().toString(36).slice(2, 10)}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
