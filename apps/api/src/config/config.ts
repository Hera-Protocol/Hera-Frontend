import { createHash } from "node:crypto";
import path from "node:path";
import { BLOCKSCOUT_API, CHAINS, HORIZON_PUBLIC } from "@hera/core";

export const APP_CONFIG = Symbol("APP_CONFIG");

/** Directory of the @hera/api package, from both src/ (tests) and dist/ (runtime). */
export const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");

const DEV_PEPPER = "hera-dev-pepper-do-not-use-in-production";
const DEV_WEBHOOK_KEY_SEED = "hera-dev-webhook-key-do-not-use-in-production";
const DEFAULT_MAIL_FROM = "Hera <no-reply@heralayer.com>";

export type MailDriver = "log" | "smtp" | "resend";

export interface AppConfig {
  env: "development" | "production" | "test";
  port: number;
  webOrigin: string;
  /** Postgres connection string. When unset, embedded PGlite is used. */
  databaseUrl?: string;
  /** PGlite data directory, or "memory://" for an in-memory database. */
  pgliteDir: string;
  /** Local data root: mail drops and report files live under it. */
  dataDir: string;
  sessionCookieName: string;
  cookieSecure: boolean;
  apiKeyPepper: string;
  /** True when the pepper fell back to the development default. */
  apiKeyPepperIsDefault: boolean;
  /** 0 disables the wallet monitor. */
  monitorIntervalMs: number;
  horizonUrl?: string;
  /** Interchangeable Horizon instances, primary first. Requests fail over between them. */
  horizonUrls: string[];
  /** Interchangeable Blockscout v2 bases per live EVM chain, primary first. */
  blockscoutUrls: Record<string, string[]>;
  /** Chain-data budget for screens a caller is waiting on (POST /screen, wallet add and refresh). The monitor uses core's fuller defaults. */
  interactiveScreen: { deadlineMs: number; maxPages: number };
  /** Express "trust proxy" setting, so rate limits see the client IP behind the Next.js proxy. */
  trustProxy: string;
  rateLimits: { authPerMinute: number; screenPerMinute: number; verifyPerMinute: number };
  mail: { driver: MailDriver; smtpUrl?: string; resendApiKey?: string; from: string };
  webhooks: {
    /** AES-256-GCM key for signing secrets at rest. */
    secretKey: Buffer;
    secretKeyIsDefault: boolean;
    /** 0 disables the dispatcher (tests call tick() directly). */
    dispatchIntervalMs: number;
  };
  /** How often the report job runner polls for queued reports. 0 disables it. */
  reportJobIntervalMs: number;
}

type Env = Record<string, string | undefined>;

function intFrom(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Expected a non-negative integer, got "${value}"`);
  return n;
}

function boolFrom(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function webhookKeyFrom(value: string | undefined): { secretKey: Buffer; secretKeyIsDefault: boolean } {
  const trimmed = value?.trim();
  if (!trimmed) return { secretKey: createHash("sha256").update(DEV_WEBHOOK_KEY_SEED).digest(), secretKeyIsDefault: true };
  const key = Buffer.from(trimmed, "base64");
  if (key.length !== 32) throw new Error("WEBHOOK_SECRET_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  return { secretKey: key, secretKeyIsDefault: false };
}

function mailDriverFrom(value: string | undefined, nodeEnv: AppConfig["env"]): MailDriver {
  const driver = value?.trim().toLowerCase();
  if (!driver) return nodeEnv === "production" ? "smtp" : "log";
  if (driver !== "log" && driver !== "smtp" && driver !== "resend") throw new Error(`MAIL_DRIVER must be "log", "smtp" or "resend", got "${value}"`);
  return driver;
}

function listFrom(value: string | undefined): string[] {
  return (value ?? "").split(",").map((v) => v.trim().replace(/\/+$/, "")).filter(Boolean);
}

/** Public Horizon instances verified on 2026-10-19. */
const DEFAULT_HORIZON_URLS = [HORIZON_PUBLIC, "https://horizon.stellar.lobstr.co"];

/**
 * Blockscout bases per live EVM chain. BLOCKSCOUT_URLS_EVM_<chainId> overrides the
 * list; BLOCKSCOUT_API_KEY appends Blockscout's keyed PRO API as a fallback.
 */
function blockscoutUrlsFrom(env: Env): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const chain of Object.values(CHAINS)) {
    if (chain.family !== "evm" || !chain.live) continue;
    const chainId = chain.id.slice("evm:".length);
    const configured = listFrom(env[`BLOCKSCOUT_URLS_EVM_${chainId}`]);
    const urls = configured.length > 0 ? configured : [BLOCKSCOUT_API[chain.id]].filter((u): u is string => Boolean(u));
    const key = env.BLOCKSCOUT_API_KEY?.trim();
    if (key) urls.push(`https://api.blockscout.com/${chainId}/api/v2?apikey=${encodeURIComponent(key)}`);
    out[chain.id] = urls;
  }
  return out;
}

export function loadConfig(env: Env = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV === "production" ? "production" : env.NODE_ENV === "test" ? "test" : "development";
  const pepper = env.API_KEY_PEPPER?.trim();
  const dataDir = env.DATA_DIR?.trim() || path.join(PACKAGE_ROOT, ".data");
  return {
    env: nodeEnv,
    port: intFrom(env.PORT, 4000),
    webOrigin: (env.WEB_ORIGIN?.trim() || "http://localhost:3000").replace(/\/+$/, ""),
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    pgliteDir: env.PGLITE_DIR?.trim() || path.join(dataDir, "pg"),
    dataDir,
    sessionCookieName: env.SESSION_COOKIE_NAME?.trim() || "hera_session",
    cookieSecure: boolFrom(env.COOKIE_SECURE, nodeEnv === "production"),
    apiKeyPepper: pepper || DEV_PEPPER,
    apiKeyPepperIsDefault: !pepper,
    monitorIntervalMs: intFrom(env.MONITOR_INTERVAL_MS, 120_000),
    horizonUrl: (listFrom(env.HORIZON_URLS)[0] ?? env.HORIZON_URL?.trim()) || undefined,
    horizonUrls: (() => {
      const list = listFrom(env.HORIZON_URLS);
      if (list.length > 0) return list;
      const single = env.HORIZON_URL?.trim();
      return single ? [single.replace(/\/+$/, "")] : DEFAULT_HORIZON_URLS;
    })(),
    blockscoutUrls: blockscoutUrlsFrom(env),
    interactiveScreen: { deadlineMs: intFrom(env.SCREEN_DEADLINE_MS, 8000), maxPages: Math.max(1, intFrom(env.SCREEN_MAX_PAGES, 2)) },
    trustProxy: env.TRUST_PROXY?.trim() || "loopback",
    rateLimits: {
      authPerMinute: intFrom(env.AUTH_RATE_LIMIT, 10),
      screenPerMinute: intFrom(env.SCREEN_RATE_LIMIT, 60),
      verifyPerMinute: intFrom(env.VERIFY_RATE_LIMIT, 30),
    },
    mail: {
      driver: mailDriverFrom(env.MAIL_DRIVER, nodeEnv),
      smtpUrl: env.SMTP_URL?.trim() || undefined,
      resendApiKey: env.RESEND_API_KEY?.trim() || undefined,
      from: env.MAIL_FROM?.trim() || DEFAULT_MAIL_FROM,
    },
    webhooks: {
      ...webhookKeyFrom(env.WEBHOOK_SECRET_KEY),
      dispatchIntervalMs: intFrom(env.WEBHOOK_DISPATCH_INTERVAL_MS, 2000),
    },
    reportJobIntervalMs: intFrom(env.REPORT_JOB_INTERVAL_MS, 5000),
  };
}
