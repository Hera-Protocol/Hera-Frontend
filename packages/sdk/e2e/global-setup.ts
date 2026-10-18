/**
 * Builds and boots the real API for the SDK e2e suite:
 *   PORT=4123, no DATABASE_URL (embedded PGlite), DATA_DIR in a fresh temp dir,
 *   cwd in that temp dir too so apps/api/.env is never loaded. Everything is
 *   removed on teardown.
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { createWriteStream, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
    logFile: string;
  }
}

const PORT = 4123;
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const MAIN = path.join(ROOT, "apps/api/dist/main.js");

let child: ChildProcess | undefined;
let dataDir: string | undefined;

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`API exited with code ${child.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (error) {
      last = error;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API did not become healthy at ${url}: ${String(last)}`);
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  if (!process.env.HERA_E2E_SKIP_BUILD) {
    console.log("[e2e] building @hera/core and @hera/api …");
    execFileSync("pnpm", ["--filter", "@hera/core", "build"], { cwd: ROOT, stdio: "inherit" });
    execFileSync("pnpm", ["--filter", "@hera/api", "build"], { cwd: ROOT, stdio: "inherit" });
  }

  dataDir = mkdtempSync(path.join(tmpdir(), "hera-sdk-e2e-"));
  const logFile = path.join(dataDir, "api.log");
  const log = createWriteStream(logFile);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(PORT),
    DATABASE_URL: "",
    DATA_DIR: dataDir,
    PGLITE_DIR: path.join(dataDir, "pg"),
    MONITOR_INTERVAL_MS: "0",
    WEBHOOK_DISPATCH_INTERVAL_MS: "500",
    REPORT_JOB_INTERVAL_MS: "500",
    MAIL_DRIVER: "log",
  };
  console.log(`[e2e] starting API on :${PORT} with data in ${dataDir}`);
  child = spawn(process.execPath, [MAIN], { cwd: dataDir, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);

  const baseUrl = `http://127.0.0.1:${PORT}/v1`;
  try {
    await waitForHealth(`${baseUrl}/health`, 120_000);
  } catch (error) {
    console.error(readFileSync(logFile, "utf8").slice(-4000));
    child.kill("SIGKILL");
    rmSync(dataDir, { recursive: true, force: true }); // teardown never runs when setup throws
    throw error;
  }
  console.log("[e2e] API is healthy");
  project.provide("baseUrl", baseUrl);
  project.provide("logFile", logFile);

  return async () => {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((r) => {
        const t = setTimeout(() => (child?.kill("SIGKILL"), r(undefined)), 5000);
        child?.once("exit", () => (clearTimeout(t), r(undefined)));
      });
    }
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    console.log("[e2e] API stopped, temp data removed");
  };
}
