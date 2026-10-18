import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Client } from "pg";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { type AppConfig, loadConfig } from "../src/config/config";
import { DATABASE, type Database } from "../src/db/database";
import { MailerService } from "../src/mail/mailer.service";
import { FETCH } from "../src/screening/screening.engine";
import { type ChainStub, createChainStub } from "./chain-stub";

export interface Harness {
  app: INestApplication;
  db: Database;
  chain: ChainStub;
  /** A fresh cookie jar, i.e. a new browser. */
  agent(): TestAgent;
  /** No cookies at all: for API-key and anonymous calls. */
  http(): ReturnType<typeof request>;
  /** Per-harness temp dir: mail drops land in `<dataDir>/mail`, reports in `<dataDir>/reports`. */
  dataDir: string;
  /** Every message the log mail driver has written so far, oldest first (waits for pending sends). */
  mail(to?: string): Promise<SentMail[]>;
  close(): Promise<void>;
}

export interface SentMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  tag: string;
}

/** The first `?token=` in a message's links. */
export function tokenFrom(mail: SentMail | undefined): string {
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(mail?.text ?? "");
  if (!match) throw new Error(`No token in mail: ${mail?.subject ?? "(none)"}`);
  return match[1]!;
}

function readMailDir(dir: string): SentMail[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".txt"))
    .sort()
    .map((file) => {
      const raw = readFileSync(path.join(dir, file), "utf8");
      const [head, ...body] = raw.split("\n\n");
      const header = (name: string) => new RegExp(`^${name}: (.*)$`, "m").exec(head ?? "")?.[1] ?? "";
      const html = readFileSync(path.join(dir, file.replace(/\.txt$/, ".html")), "utf8");
      return { to: header("To"), subject: header("Subject"), tag: header("X-Hera-Template"), text: body.join("\n\n"), html };
    });
}

/**
 * With HERA_TEST_PG_URL (set by `pnpm test:pg`), each harness gets a fresh
 * database on that server, so the node-postgres driver path is exercised.
 * Otherwise it's in-memory PGlite.
 */
async function freshPostgres(): Promise<{ url: string; drop: () => Promise<void> } | undefined> {
  const admin = process.env.HERA_TEST_PG_URL;
  if (!admin) return undefined;
  const name = `hera_test_${randomBytes(6).toString("hex")}`;
  const run = async (sql: string) => {
    const client = new Client({ connectionString: admin });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  };
  await run(`create database ${name}`);
  const url = new URL(admin);
  url.pathname = `/${name}`;
  return { url: url.toString(), drop: () => run(`drop database if exists ${name} with (force)`) };
}

export async function createHarness(overrides: Partial<AppConfig> = {}): Promise<Harness> {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "hera-api-test-"));
  const pg = await freshPostgres();
  const config: AppConfig = {
    ...loadConfig({ NODE_ENV: "test" }),
    databaseUrl: pg?.url,
    pgliteDir: "memory://",
    dataDir,
    rateLimits: { authPerMinute: 10_000, screenPerMinute: 10_000, verifyPerMinute: 10_000 },
    ...overrides,
  };
  const chain = createChainStub();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(config)] })
    .overrideProvider(FETCH)
    .useValue(chain.fetch)
    .compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: ["error", "warn"] });
  configureApp(app, config);
  await app.init();
  const server = app.getHttpServer();
  return {
    app,
    db: app.get<Database>(DATABASE),
    chain,
    agent: () => request.agent(server),
    http: () => request(server),
    dataDir,
    mail: async (to) => {
      await app.get(MailerService).flush();
      const all = readMailDir(path.join(dataDir, "mail"));
      return to ? all.filter((m) => m.to === to) : all;
    },
    close: async () => {
      await app.close();
      await pg?.drop();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

let counter = 0;

export function newUser(overrides: Partial<{ name: string; email: string; company: string; password: string; plan: string }> = {}) {
  counter++;
  return {
    name: "Ada Analyst",
    email: `ada${counter}-${Date.now()}@example.com`,
    company: "Acme Exchange",
    password: "correct horse 42",
    ...overrides,
  };
}

/** Sign up in a fresh cookie jar and return the logged-in agent. */
export async function signedIn(h: Harness, overrides: Parameters<typeof newUser>[0] = {}) {
  const user = newUser(overrides);
  const agent = h.agent();
  const res = await agent.post("/v1/auth/signup").send(user).expect(201);
  return { agent, user, me: res.body as import("@hera/core").MeResponse };
}
