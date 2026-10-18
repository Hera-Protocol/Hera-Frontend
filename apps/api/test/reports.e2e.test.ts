import { createHash } from "node:crypto";
import type { AlertDto, ApiErrorBody, AuditEventDto, CreateApiKeyResponse, ReportDto, ReportVerifyResponse, TravelRuleTransferDto } from "@hera/core";
import { and, eq } from "drizzle-orm";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { memberships, webhookEvents } from "../src/db/schema";
import { ReportJobs } from "../src/reports/report-jobs.service";
import { periodCode } from "../src/reports/reference";
import type { AuditSnapshot, EvidenceSnapshot, TravelRuleSnapshot } from "../src/reports/snapshot";
import { SANCTIONED } from "./chain-stub";
import { createHarness, type Harness, signedIn } from "./harness";

const errorOf = (body: unknown) => (body as ApiErrorBody).error;
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
/** supertest buffers binary bodies only when asked. */
const binary = (res: Response, cb: (error: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};
const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

let h: Harness;
let owner: Awaited<ReturnType<typeof signedIn>>;
let screeningId: string;
let transfer: TravelRuleTransferDto;
let evidence: ReportDto;

beforeAll(async () => {
  h = await createHarness();
  owner = await signedIn(h, { name: "Rita Reporter", company: "Report Ltd" });
  screeningId = ((await owner.agent.post("/v1/screen").send({ address: SANCTIONED }).expect(200)).body as { id: string }).id;
  await owner.agent.post("/v1/screen").send({ address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" }).expect(200);
  await owner.agent.post("/v1/wallets").send({ address: SANCTIONED, label: "Ronin" }).expect(201);
  const [alert] = (await owner.agent.get("/v1/alerts").expect(200)).body as AlertDto[];
  await owner.agent.patch(`/v1/alerts/${alert!.id}`).send({ status: "escalated" }).expect(200);
  await owner.agent.patch(`/v1/alerts/${alert!.id}`).send({ status: "closed", disposition: "true_positive", note: "Frozen." }).expect(200);
  transfer = (
    await owner.agent
      .post("/v1/travel-rule/transfers")
      .send({
        direction: "outgoing",
        chain: "evm:1",
        asset: "USDC",
        amount: "5000",
        amountUsd: 5000,
        jurisdiction: "US",
        originator: { type: "natural", firstName: "Orla", lastName: "Privatename", customerId: "C-77" },
        originatorAccount: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
        beneficiary: { type: "legal", legalName: "Beneficiary GmbH" },
        beneficiaryAccount: { address: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3" },
        beneficiaryVasp: { name: "Coinbase", lei: "549300ZJ7HSN6TTQ6P20" },
      })
      .expect(201)
  ).body as TravelRuleTransferDto;
  await owner.agent.post(`/v1/travel-rule/transfers/${transfer.id}/transition`).send({ to: "awaiting_counterparty", note: "Sent" }).expect(200);
  // Someone is listening for report.ready.
  await owner.agent.post("/v1/webhooks").send({ url: "http://127.0.0.1:9/never", events: ["report.ready"] }).expect(201);
});

afterAll(async () => {
  await h?.close();
});

async function download(id: string, kind: "pdf" | "json", agent = owner.agent) {
  const res = await agent.get(`/v1/reports/${id}/${kind}`).buffer(true).parse(binary).expect(200);
  return { res, bytes: res.body as Buffer };
}

describe("screening evidence", () => {
  it("renders synchronously and hashes both artifacts", async () => {
    const res = await owner.agent.post("/v1/reports").send({ type: "screening_evidence", screeningId }).expect(201);
    evidence = res.body as ReportDto;
    expect(evidence).toMatchObject({ type: "screening_evidence", status: "ready", requestedBy: `Rita Reporter (${owner.user.email})` });
    expect(evidence.reference).toMatch(/^RPT-\d{6}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(evidence.title).toContain("Screening evidence");
    expect(evidence.jsonSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.pdfSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.readyAt).toBeDefined();
  });

  it("serves the PDF as an attachment whose bytes match pdfSha256", async () => {
    const { res, bytes } = await download(evidence.id, "pdf");
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toBe(`attachment; filename="${evidence.reference}.pdf"`);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(sha256(bytes)).toBe(evidence.pdfSha256);
    expect(pageCount(bytes)).toBeGreaterThanOrEqual(1);
  });

  it("serves the frozen snapshot whose bytes match jsonSha256", async () => {
    const { res, bytes } = await download(evidence.id, "json");
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(sha256(bytes)).toBe(evidence.jsonSha256);
    const snapshot = JSON.parse(bytes.toString()) as EvidenceSnapshot;
    expect(snapshot).toMatchObject({ schema: "hera.report/v1", reference: evidence.reference, type: "screening_evidence", org: { name: "Report Ltd" } });
    expect(snapshot.verifyUrl).toBe(`http://localhost:3000/verify/${evidence.reference}`);
    expect(snapshot.screening).toMatchObject({ id: screeningId, score: 100, band: "severe", decision: "block" });
    expect(snapshot.reasons[0]).toMatchObject({ code: "SANCTIONS_DIRECT", points: 100, provenance: { source: "OFAC SDN list" } });
    expect(snapshot.transfers).toHaveLength(1);
    expect(snapshot.dataSources[0]).toMatch(/Blockscout/);
  });

  it("verifies either hash publicly, and nothing else", async () => {
    const byPdf = (await h.http().get(`/v1/reports/verify?sha256=${evidence.pdfSha256}`).expect(200)).body as ReportVerifyResponse;
    expect(byPdf).toEqual({ valid: true, reference: evidence.reference, type: "screening_evidence", orgName: "Report Ltd", createdAt: evidence.createdAt, matched: "pdf" });
    const byJson = (await h.http().get(`/v1/reports/verify?sha256=${evidence.jsonSha256!.toUpperCase()}`).expect(200)).body as ReportVerifyResponse;
    expect(byJson).toMatchObject({ valid: true, matched: "json" });
    expect(JSON.stringify(byJson)).not.toContain("SANCTIONS");

    await h.http().get(`/v1/reports/verify?sha256=${sha256(Buffer.from("random"))}`).expect(200, { valid: false });
    await h.http().get("/v1/reports/verify?sha256=not-a-hash").expect(200, { valid: false });
    await h.http().get("/v1/reports/verify").expect(422);
  });

  it("404s other orgs' screenings and reports", async () => {
    const other = await signedIn(h);
    await other.agent.post("/v1/reports").send({ type: "screening_evidence", screeningId }).expect(404);
    await other.agent.get(`/v1/reports/${evidence.id}`).expect(404);
    await other.agent.get(`/v1/reports/${evidence.id}/pdf`).expect(404);
    expect((await other.agent.get("/v1/reports").expect(200)).body).toEqual([]);
  });
});

describe("travel rule record", () => {
  it("renders the IVMS101 parties, threshold check and timeline", async () => {
    const report = (await owner.agent.post("/v1/reports").send({ type: "travel_rule", transferId: transfer.id }).expect(201)).body as ReportDto;
    expect(report).toMatchObject({ type: "travel_rule", status: "ready", title: `Travel Rule record ${transfer.reference}` });
    const { bytes: pdf } = await download(report.id, "pdf");
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const snapshot = JSON.parse((await download(report.id, "json")).bytes.toString()) as TravelRuleSnapshot;
    expect(snapshot.transfer.originator).toMatchObject({ firstName: "Orla", lastName: "Privatename" });
    expect(snapshot.transfer.events.map((e) => e.status)).toEqual(["draft", "awaiting_counterparty"]);
    expect(snapshot.jurisdiction).toMatchObject({ code: "US", threshold: 3000 });
    expect(snapshot.transfer.check.required).toBe(true);
  });
});

describe("audit report", () => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  let queued: ReportDto;

  it("queues, then renders in the job runner", async () => {
    const res = await owner.agent.post("/v1/reports").send({ type: "audit", from: monthStart, to: today }).expect(202);
    queued = res.body as ReportDto;
    expect(queued).toMatchObject({ type: "audit", status: "queued" });
    expect(queued.reference).toMatch(new RegExp(`^RPT-${today.slice(0, 4)}${today.slice(5, 7)}-`));
    expect(queued.jsonSha256).toBeUndefined();
    const notReady = await owner.agent.get(`/v1/reports/${queued.id}/pdf`).expect(409);
    expect(errorOf(notReady.body).code).toBe("report_not_ready");

    expect(await h.app.get(ReportJobs).tick()).toEqual({ ready: 1, failed: 0 });
    expect(await h.app.get(ReportJobs).tick()).toEqual({ ready: 0, failed: 0 });
    const ready = (await owner.agent.get(`/v1/reports/${queued.id}`).expect(200)).body as ReportDto;
    expect(ready).toMatchObject({ status: "ready", reference: queued.reference });
    expect(ready.pdfSha256).toMatch(/^[0-9a-f]{64}$/);
    queued = ready;
  });

  it("computes the numbers from the period, with counts only", async () => {
    const { bytes } = await download(queued.id, "json");
    expect(sha256(bytes)).toBe(queued.jsonSha256);
    const snapshot = JSON.parse(bytes.toString()) as AuditSnapshot;
    expect(snapshot.kpis).toMatchObject({ screenings: 2, flagged: 1, blocked: 1, alertsOpened: 1, alertsClosed: 1, travelRuleTransfers: 1, watchedWallets: 1 });
    expect(snapshot.screenings.chains.map((c) => c.id)).toEqual(["evm:1", "stellar"]);
    expect(snapshot.screenings.rows.find((r) => r.band === "severe")).toMatchObject({ counts: { "evm:1": 1 }, total: 1 });
    expect(snapshot.alerts).toMatchObject({ opened: 1, closedTruePositive: 1, closedFalsePositive: 0, escalated: 1, openAtEnd: 0 });
    expect(snapshot.alerts.medianHoursToDecision).toBeGreaterThanOrEqual(0);
    expect(snapshot.travelRule.rows).toEqual([expect.objectContaining({ jurisdiction: "US", transfers: 1, required: 1, completed: 0, completionPct: 0 })]);
    expect(snapshot.auditLog).toMatchObject({ valid: true });
    expect(snapshot.auditLog.checked).toBeGreaterThan(5);
    expect(snapshot.summary[0]).toMatch(/2 screenings across 2 chains; 1 \(50%\) were flagged/);
    expect(snapshot.methodology.labelSources.map((s) => s.source)).toContain("OFAC SDN list");
    expect(snapshot.methodology.jurisdictions.map((j) => j.code)).toContain("EU");
    // IVMS101 personal data never reaches the org-wide report.
    expect(bytes.toString()).not.toMatch(/Orla|Privatename|Beneficiary GmbH|C-77/);
  });

  it("serves a multi-page PDF that verifies", async () => {
    const { bytes } = await download(queued.id, "pdf");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(sha256(bytes)).toBe(queued.pdfSha256);
    expect(pageCount(bytes)).toBeGreaterThanOrEqual(2); // the methodology appendix starts a new page
    expect((await h.http().get(`/v1/reports/verify?sha256=${queued.pdfSha256}`).expect(200)).body).toMatchObject({ valid: true, type: "audit", matched: "pdf" });
  });

  it("audits report.generated with both hashes, emits report.ready and emails the requester", async () => {
    const events = (await owner.agent.get("/v1/audit?limit=200").expect(200)).body as AuditEventDto[];
    const generated = events.filter((e) => e.action === "report.generated");
    expect(generated).toHaveLength(3);
    expect(generated.find((e) => e.target === queued.id)?.metadata).toMatchObject({ jsonSha256: queued.jsonSha256, pdfSha256: queued.pdfSha256, reference: queued.reference });

    const ready = await h.db.select().from(webhookEvents).where(and(eq(webhookEvents.orgId, owner.me.org.id), eq(webhookEvents.type, "report.ready")));
    expect(ready).toHaveLength(3);
    expect(ready.map((e) => (JSON.parse(e.body) as { data: ReportDto }).data.id)).toContain(queued.id);

    const mail = (await h.mail(owner.user.email)).filter((m) => m.tag === "report-ready");
    expect(mail).toHaveLength(1); // only the async report emails
    expect(mail[0]!.subject).toContain("Compliance audit report");
  });

  it("validates the range and names quarters", async () => {
    const bad = await owner.agent.post("/v1/reports").send({ type: "audit", from: "2026-10-02", to: "2026-10-01" }).expect(422);
    expect(errorOf(bad.body).fields).toHaveProperty("to");
    await owner.agent.post("/v1/reports").send({ type: "nope" }).expect(422);
    expect(periodCode("2026-07-01", "2026-09-30")).toBe("2026Q3");
    expect(periodCode("2026-01-01", "2026-03-31")).toBe("2026Q1");
    expect(periodCode("2026-07-01", "2026-09-29")).toBe("202607");
    const quarter = (await owner.agent.post("/v1/reports").send({ type: "audit", from: "2026-07-01", to: "2026-09-30" }).expect(202)).body as ReportDto;
    expect(quarter.reference).toMatch(/^RPT-2026Q3-[0-9A-Z]{4}$/);
    expect(quarter.title).toBe("Compliance audit report: Q3 2026 (1 Jul 2026 – 30 Sep 2026)");
    await h.app.get(ReportJobs).tick();
  });
});

describe("report access", () => {
  it("lets a viewer read and download, but not create", async () => {
    const viewer = await signedIn(h);
    await h.db.update(memberships).set({ orgId: owner.me.org.id, role: "viewer" }).where(eq(memberships.userId, viewer.me.user.id));
    await h.db.execute(`update sessions set org_id = '${owner.me.org.id}' where user_id = '${viewer.me.user.id}'`);

    const list = (await viewer.agent.get("/v1/reports").expect(200)).body as ReportDto[];
    expect(list.map((r) => r.id)).toContain(evidence.id);
    await viewer.agent.get(`/v1/reports/${evidence.id}`).expect(200);
    const { bytes } = await download(evidence.id, "pdf", viewer.agent);
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    const denied = await viewer.agent.post("/v1/reports").send({ type: "screening_evidence", screeningId }).expect(403);
    expect(errorOf(denied.body).code).toBe("forbidden");
  });

  it("lets read-scoped API keys create and fetch evidence, with stricter rules for PII and audit", async () => {
    const read = (await owner.agent.post("/v1/keys").send({ name: "SDK", scopes: ["read"] }).expect(201)).body as CreateApiKeyResponse;
    const auth = ["Authorization", `Bearer ${read.secret}`] as const;
    const created = (await h.http().post("/v1/reports").set(...auth).send({ type: "screening_evidence", screeningId }).expect(201)).body as ReportDto;
    expect(created.requestedBy).toMatch(/^API key "SDK"/);
    await h.http().get("/v1/reports").set(...auth).expect(200);
    await h.http().get(`/v1/reports/${created.id}`).set(...auth).expect(200);
    const pdf = await h.http().get(`/v1/reports/${created.id}/pdf`).set(...auth).buffer(true).parse(binary).expect(200);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");

    await h.http().post("/v1/reports").set(...auth).send({ type: "travel_rule", transferId: transfer.id }).expect(403);
    await h.http().post("/v1/reports").set(...auth).send({ type: "audit", from: "2026-10-01", to: "2026-10-02" }).expect(403);

    const both = (await owner.agent.post("/v1/keys").send({ name: "TR", scopes: ["read", "travel_rule"] }).expect(201)).body as CreateApiKeyResponse;
    await h.http().post("/v1/reports").set("Authorization", `Bearer ${both.secret}`).send({ type: "travel_rule", transferId: transfer.id }).expect(201);

    const screenOnly = (await owner.agent.post("/v1/keys").send({ name: "Screen", scopes: ["screen"] }).expect(201)).body as CreateApiKeyResponse;
    await h.http().get("/v1/reports").set("Authorization", `Bearer ${screenOnly.secret}`).expect(403);
  });
});
