import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Lock, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { useHeraConfig } from "@/lib/hera-config";

const DEMO_USERNAME = "Username";
const DEMO_PASSWORD = "Hera123";
const DEMO_API_BASE_URL =
  (import.meta.env.VITE_HERA_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:3000";
const DEMO_API_KEY =
  (import.meta.env.VITE_HERA_API_KEY as string | undefined) ??
  "hera-demo-api-key";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { username: savedUsername, updateConnection } = useHeraConfig();
  const [username, setUsername] = useState(savedUsername);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const redirectTo =
    typeof (location.state as { from?: string } | null)?.from === "string"
      ? (location.state as { from: string }).from
      : "/dashboard";

  const completeLogin = (next: {
    apiBaseUrl: string;
    apiKey: string;
    username?: string;
  }) => {
    updateConnection({
      apiBaseUrl: next.apiBaseUrl,
      apiKey: next.apiKey,
      username: next.username ?? username,
    });
    toast("Signed in successfully.");
    navigate(redirectTo, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setSubmitting(true);
    try {
      if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
        completeLogin({
          apiBaseUrl: DEMO_API_BASE_URL,
          apiKey: DEMO_API_KEY,
          username,
        });
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const body = (await response.json().catch(() => null)) as
        | { username?: string; apiBaseUrl?: string; apiKey?: string; error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Login failed.");
      }

      if (!body?.apiBaseUrl || !body?.apiKey) {
        throw new Error("Login response was incomplete.");
      }

      completeLogin({
        apiBaseUrl: body.apiBaseUrl,
        apiKey: body.apiKey,
        username: body.username ?? username,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
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
              <h1 className="text-2xl font-mono font-bold">Sign in to Hera</h1>
              <p className="text-sm text-muted-foreground">
                Enter your username and password to open the beta workspace.
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                Demo access: <span className="text-foreground">Username</span> / <span className="text-foreground">Hera123</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-tag block mb-2">Username</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-muted border border-border pl-9 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-tag">Password</label>
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Hera123"
                    className="w-full bg-muted border border-border pl-9 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!username || !password || submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {submitting ? "Signing In..." : "Enter Workspace"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Need access?{" "}
                <Link to="/request-access" className="text-primary hover:text-primary/80">
                  Request early access
                </Link>
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-6 font-mono">
            Protected by SOC 2 · ISO 27001 · Private beta access
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
