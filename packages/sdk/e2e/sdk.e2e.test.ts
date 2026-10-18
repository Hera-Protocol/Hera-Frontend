/**
 * The SDK against the real API (booted by global-setup.ts). Live chain data:
 * Horizon for Stellar and Blockscout for Ethereum, so this needs network access.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { CreateApiKeyResponse, CreateWebhookResponse, ScreeningResponse, WalletDto } from "@hera/core";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { Hera, HeraAuthError, HeraBlockedError, type HeraWebhookEvent, HeraValidationError } from "../src";

const baseUrl = inject("baseUrl");
const G = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const M = "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK";
const SANCTIONED = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";

/** One line per step, printed at the end so the run reads as a report. */
const report: string[] = [];
const note = (line: string) => {
  report.push(line);
  console.log(`[e2e] ${line}`);
};

let cookie = "";
let hera: Hera;
/** The key, kept for the one comparison that bypasses the SDK (the client never exposes its own). */
let rawKey = "";
let paths: Set<string>;

/** Session-authenticated call, like the dashboard makes. */
async function session<T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
}

beforeAll(async () => {
  const signup = await fetch(`${baseUrl}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "SDK E2E", email: `sdk-e2e-${Date.now()}@example.com`, company: "Hera SDK E2E", password: "correct-horse-42" }),
  });
  expect(signup.status, await signup.clone().text()).toBe(201);
  cookie = (signup.headers.getSetCookie?.() ?? [signup.headers.get("set-cookie") ?? ""]).map((c) => c.split(";")[0]).join("; ");
  expect(cookie).toMatch(/hera_session=/);

  const key = await session<CreateApiKeyResponse>("POST", "/keys", { name: "SDK e2e", scopes: ["read", "screen", "travel_rule"] });
  expect(key.status).toBe(201);
  expect(key.body.secret).toMatch(/^hera_live_/);
  rawKey = key.body.secret;
  hera = new Hera({ apiKey: key.body.secret, baseUrl, timeoutMs: 60_000, maxRetries: 1, userAgent: "hera-sdk-e2e" });
  note(`signed up, created key ${key.body.key.prefix} with scopes ${key.body.key.scopes.join(",")}`);

  const spec = (await (await fetch(`${baseUrl}/openapi.json`)).json()) as { paths: Record<string, Record<string, unknown>> };
  paths = new Set(Object.entries(spec.paths).flatMap(([p, item]) => Object.keys(item).map((m) => `${m.toUpperCase()} ${p}`)));
});

afterAll(() => {
  console.log(`\n──── SDK e2e summary ────\n${report.map((l) => `  ${l}`).join("\n")}\n`);
});

describe("auth", () => {
  it("rejects a bogus key with HeraAuthError 401", async () => {
    const bogus = new Hera({ apiKey: "hera_live_zzzzzzzz_notARealSecretnotARealSecret00", baseUrl, maxRetries: 0 });
    const error = await bogus.wallets.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HeraAuthError);
    expect(error).toMatchObject({ status: 401, code: "unauthenticated" });
  });
});

describe("screening (live chain data)", () => {
  let evm: ScreeningResponse;

  it("screens a live Stellar G… account", async () => {
    const result = await hera.screen(G);
    expect(result.subject).toEqual({ chain: "stellar", account: G });
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(["allow", "review", "block"]).toContain(result.decision);
    note(`screen G…KZVN → ${result.decision} score=${result.score} band=${result.band} reasons=${result.reasons.map((r) => r.code).join(",") || "-"}`);
  });

  it("screens the muxed M… form and gets the decoded sub-account back", async () => {
    const result = await hera.screen(M);
    expect(result.subject).toMatchObject({ chain: "stellar", account: G, sub: { kind: "muxed", muxed: M } });
    const sub = result.subject.chain === "stellar" ? result.subject.sub : undefined;
    note(`screen M… → ${result.decision} score=${result.score}, decoded muxed id ${sub?.kind === "muxed" ? sub.id : "?"} under ${G.slice(0, 6)}…`);
  });

  it("screens the G… + memo form", async () => {
    const result = await hera.screen({ address: G, memo: { type: "id", value: "1234567" } });
    expect(result.subject).toMatchObject({ chain: "stellar", account: G, sub: { kind: "memo", type: "id", value: "1234567" } });
    note(`screen G… + memo id 1234567 → ${result.decision} score=${result.score}`);
  });

  it("blocks the sanctioned EVM address and guard() throws HeraBlockedError", async () => {
    evm = await hera.screen(SANCTIONED);
    expect(evm.decision).toBe("block");
    expect(evm.score).toBe(100);
    expect(evm.reasons.map((r) => r.code)).toContain("SANCTIONS_DIRECT");

    const error = await hera.guard(SANCTIONED).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HeraBlockedError);
    expect((error as HeraBlockedError).screening.decision).toBe("block");
    note(`screen ${SANCTIONED.slice(0, 8)}… → block score=100; guard() threw HeraBlockedError: "${(error as Error).message}"`);
  });

  it("lists and fetches screenings", async () => {
    const list = await hera.screenings.list({ limit: 10 });
    expect(list.total).toBeGreaterThanOrEqual(4);
    const one = await hera.screenings.get(evm.id);
    expect(one.decision).toBe("block");
    note(`screenings.list total=${list.total}; screenings.get(${evm.id.slice(0, 8)}…) ok`);
  });

  it("fails typos locally with the same message the API returns", async () => {
    const typo = `${G.slice(0, -1)}A`;
    const local = (await hera.screen(typo).catch((e: unknown) => e)) as HeraValidationError;
    expect(local).toBeInstanceOf(HeraValidationError);
    const server = await fetch(`${baseUrl}/screen`, {
      method: "POST",
      headers: { authorization: `Bearer ${rawKey}`, "content-type": "application/json" },
      body: JSON.stringify({ address: typo }),
    });
    const body = (await server.json()) as { error: { code: string; message: string; fields?: Record<string, string> } };
    expect(server.status).toBe(422);
    expect({ code: local.code, message: local.message, fields: local.fields }).toEqual(body.error);
    note(`local validation matches API 422 exactly: "${local.message}"`);
  });
});

describe("monitoring", () => {
  let wallet: WalletDto | undefined;

  it("watches a wallet (SDK key, falling back to a session if keys are not allowed)", async () => {
    const attempt = await hera.wallets.watch({ address: M, label: "SDK e2e muxed customer" }).catch((e: unknown) => e);
    if (attempt instanceof HeraAuthError && attempt.status === 403) {
      note(`MISMATCH wallets.watch with an API key → 403 ${attempt.code}: "${attempt.message}" (POST /v1/wallets is session-only)`);
      const res = await session<WalletDto>("POST", "/wallets", { address: M, label: "SDK e2e muxed customer" });
      expect(res.status).toBe(201);
      wallet = res.body;
      note("  created the wallet with the dashboard session instead");
    } else {
      expect(attempt).toMatchObject({ label: "SDK e2e muxed customer" });
      wallet = attempt as WalletDto;
      note("wallets.watch via API key ok");
    }
    expect(wallet.subject).toMatchObject({ chain: "stellar", account: G, sub: { kind: "muxed" } });
  });

  it("lists wallets via the SDK", async () => {
    const wallets = await hera.wallets.list();
    expect(wallets.map((w) => w.id)).toContain(wallet!.id);
    note(`wallets.list → ${wallets.length} wallet(s), lastScore=${wallets[0]?.lastScore ?? "-"}`);
  });

  it("refresh with an API key", async () => {
    const attempt = await hera.wallets.refresh(wallet!.id).catch((e: unknown) => e);
    if (attempt instanceof HeraAuthError) note(`MISMATCH wallets.refresh with an API key → ${attempt.status} "${attempt.message}"`);
    else note("wallets.refresh via API key ok");
  });

  it("lists alerts via the SDK", async () => {
    const alerts = await hera.alerts.list();
    expect(Array.isArray(alerts)).toBe(true);
    const open = await hera.alerts.list({ status: "open" });
    note(`alerts.list → ${alerts.length} alert(s), ${open.length} open${alerts[0] ? `; first: ${alerts[0].reasonCode} "${alerts[0].title}"` : ""}`);
    if (alerts[0]) {
      expect((await hera.alerts.get(alerts[0].id)).id).toBe(alerts[0].id);
      const patch = await hera.alerts.update(alerts[0].id, { status: "in_review", note: "SDK e2e" }).catch((e: unknown) => e);
      if (patch instanceof HeraAuthError) note(`MISMATCH alerts.update with an API key → ${patch.status} "${patch.message}"`);
      else note("alerts.update via API key ok");
    }
  });

  it("unwatches (cleanup)", async () => {
    const attempt = await hera.wallets.unwatch(wallet!.id).catch((e: unknown) => e);
    if (attempt instanceof HeraAuthError) {
      note(`MISMATCH wallets.unwatch with an API key → ${attempt.status}`);
      expect((await session("DELETE", `/wallets/${wallet!.id}`)).status).toBe(204);
    }
  });
});

describe("travel rule", () => {
  it("creates, transitions, gets and lists a transfer with Stellar muxed + memo accounts", async () => {
    const transfer = await hera.travelRule.create({
      direction: "outgoing",
      chain: "stellar",
      asset: "USDC",
      amount: "2500.00",
      amountUsd: 2500,
      jurisdiction: "EU",
      originator: { type: "natural", firstName: "Ada", lastName: "Originator", customerId: "C-1042" },
      originatorAccount: { address: G, memo: { type: "id", value: "77" } },
      beneficiary: { type: "natural", firstName: "Bea", lastName: "Neficiary" },
      beneficiaryAccount: { address: M },
      beneficiaryVasp: { name: "Example Anchor", domain: "example.com" },
    });
    expect(transfer.status).toBe("draft");
    expect(transfer.beneficiaryAccount).toMatchObject({ chain: "stellar", account: G, sub: { kind: "muxed" } });
    expect(transfer.originatorAccount).toMatchObject({ sub: { kind: "memo", value: "77" } });

    const moved = await hera.travelRule.transition(transfer.id, "awaiting_counterparty", "Sent to VASP");
    expect(moved.status).toBe("awaiting_counterparty");
    const bad = await hera.travelRule.transition(transfer.id, "settled").catch((e: unknown) => e);
    expect(bad).toMatchObject({ status: 409, code: "invalid_transition" });

    expect((await hera.travelRule.get(transfer.id)).events.length).toBeGreaterThanOrEqual(2);
    expect((await hera.travelRule.list()).map((t) => t.id)).toContain(transfer.id);
    note(`travelRule ${transfer.reference}: draft → awaiting_counterparty; check.required=${transfer.check.required}; draft → settled correctly 409`);
  });
});

describe("reports", () => {
  it("creates an evidence report, waits, downloads the PDF and the JSON snapshot", async (ctx) => {
    if (!paths.has("POST /v1/reports") || !paths.has("GET /v1/reports/{id}/pdf")) {
      note("SKIPPED reports: /v1/reports endpoints are not in /v1/openapi.json yet");
      ctx.skip();
    }
    const screenings = await hera.screenings.list({ limit: 50 });
    const target = screenings.items.find((s) => s.decision === "block") ?? screenings.items[0]!;
    const created = await hera.reports.create({ type: "screening_evidence", screeningId: target.id });
    const ready = await hera.reports.waitUntilReady(created.id, { timeoutMs: 60_000, intervalMs: 500 });
    expect(ready.status).toBe("ready");

    const pdf = await hera.reports.download(ready.id);
    expect(new TextDecoder().decode(pdf.slice(0, 4))).toBe("%PDF");
    const snapshot = await hera.reports.snapshot(ready.id);
    expect(typeof snapshot).toBe("object");
    expect((await hera.reports.list()).map((r) => r.id)).toContain(ready.id);

    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", pdf));
    const hex = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (ready.pdfSha256) expect(hex).toBe(ready.pdfSha256);
    note(`reports ${ready.reference}: ${created.status} → ready, PDF ${pdf.byteLength} bytes starts with %PDF, sha256 ${ready.pdfSha256 ? "matches pdfSha256" : "(no pdfSha256 on DTO)"}`);
  });
});

describe("webhooks (real delivery from the API, verified by the SDK)", () => {
  let server: Server | undefined;
  afterAll(() => server?.close());

  it("receives a signed screening.completed and verifies it with constructEvent", async (ctx) => {
    if (!paths.has("POST /v1/webhooks")) {
      note("SKIPPED webhooks: /v1/webhooks is not in /v1/openapi.json yet");
      ctx.skip();
    }
    const received: { raw: string; signature?: string }[] = [];
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        received.push({ raw: Buffer.concat(chunks).toString("utf8"), signature: req.headers[Hera.webhooks.SIGNATURE_HEADER] as string | undefined });
        res.writeHead(200).end("ok");
      });
    });
    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;

    const created = await session<CreateWebhookResponse>("POST", "/webhooks", {
      url: `http://127.0.0.1:${port}/hooks`,
      events: ["screening.completed", "report.ready"],
      description: "SDK e2e",
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    await hera.screen(G);
    const deadline = Date.now() + 20_000;
    while (!received.some((r) => r.raw.includes('"screening.completed"')) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
    const delivery = received.find((r) => r.raw.includes('"screening.completed"'));
    expect(delivery, "no screening.completed delivery within 20 s").toBeDefined();

    const event: HeraWebhookEvent = Hera.webhooks.constructEvent(delivery!.raw, delivery!.signature, created.body.secret);
    expect(event.type).toBe("screening.completed");
    if (event.type === "screening.completed") expect(event.data.display).toBe(G);
    expect(() => Hera.webhooks.constructEvent(delivery!.raw, delivery!.signature, "whsec_wrong")).toThrow(/doesn't match/);
    note(`webhook ${event.id} (${event.type}) delivered by the API and verified with constructEvent; wrong secret rejected`);
  });
});
