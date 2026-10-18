import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  type ApiErrorBody,
  type AuditEventDto,
  type CreateApiKeyResponse,
  type CreateWebhookResponse,
  verifyWebhookSignature,
  type WalletDto,
  type WebhookDeliveryDto,
  type WebhookEndpointDto,
  type WebhookEvent,
} from "@hera/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { memberships, wallets, webhookDeliveries, webhookEndpoints } from "../src/db/schema";
import { MAX_ATTEMPTS, WebhookDispatcher } from "../src/webhooks/dispatcher.service";
import { SANCTIONED } from "./chain-stub";
import { createHarness, type Harness, signedIn } from "./harness";

const JSON_HEADER = ["Content-Type", "application/json"] as const;
const errorOf = (body: unknown) => (body as ApiErrorBody).error;

interface Received {
  headers: IncomingHttpHeaders;
  body: string;
}

/** A tiny receiver: records every request and answers with the next queued status (200 by default). */
function receiver() {
  const received: Received[] = [];
  const statuses: number[] = [];
  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      const status = statuses.shift() ?? 200;
      res.writeHead(status, { "content-type": "text/plain" }).end(status >= 400 ? `receiver says ${status}` : "ok");
    });
  });
  return {
    received,
    statuses,
    async start() {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
    },
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

let h: Harness;
let owner: Awaited<ReturnType<typeof signedIn>>;
let dispatcher: WebhookDispatcher;
const hook = receiver();
let url: string;
let endpoint: CreateWebhookResponse;

beforeAll(async () => {
  h = await createHarness();
  owner = await signedIn(h, { company: "Webhook Co" });
  dispatcher = h.app.get(WebhookDispatcher);
  url = await hook.start();
});

afterAll(async () => {
  await h?.close();
  await hook.stop();
});

beforeEach(() => {
  hook.received.length = 0;
  hook.statuses.length = 0;
});

const deliveries = async (id = endpoint.endpoint.id) => (await owner.agent.get(`/v1/webhooks/${id}/deliveries`).expect(200)).body as WebhookDeliveryDto[];
const makeDue = (endpointId = endpoint.endpoint.id) => h.db.update(webhookDeliveries).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(webhookDeliveries.endpointId, endpointId));

function verified(request: Received, secret: string) {
  return verifyWebhookSignature({ payload: request.body, header: request.headers["hera-signature"] as string, secret });
}

describe("endpoint management", () => {
  it("creates an endpoint and shows the secret once", async () => {
    const res = await owner.agent
      .post("/v1/webhooks")
      .send({ url, events: ["screening.completed", "alert.created", "wallet.activity", "travel_rule.updated"], description: "Local receiver" })
      .expect(201);
    endpoint = res.body as CreateWebhookResponse;
    expect(endpoint.secret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    expect(endpoint.endpoint).toMatchObject({ url, enabled: true, failureCount: 0, secretPrefix: endpoint.secret.slice(0, 12), description: "Local receiver" });

    const [row] = await h.db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, endpoint.endpoint.id));
    expect(row!.secretCiphertext).not.toContain(endpoint.secret.slice(6));
    expect(row!.secretCiphertext).toMatch(/^v1\./);
    const list = (await owner.agent.get("/v1/webhooks").expect(200)).body as WebhookEndpointDto[];
    expect(JSON.stringify(list)).not.toContain(endpoint.secret);
  });

  it("validates URLs and events", async () => {
    const http = await owner.agent.post("/v1/webhooks").send({ url: "http://example.com/hook", events: ["alert.created"] }).expect(422);
    expect(errorOf(http.body).fields).toHaveProperty("url");
    await owner.agent.post("/v1/webhooks").send({ url, events: [] }).expect(422);
    await owner.agent.post("/v1/webhooks").send({ url, events: ["nope"] }).expect(422);
  });

  it("lets analysts read, but only admins manage; viewers and API keys get 403", async () => {
    const analyst = await signedIn(h);
    // Move them into this org as an analyst.
    await h.db.update(memberships).set({ orgId: owner.me.org.id, role: "analyst" }).where(eq(memberships.userId, analyst.me.user.id));
    await h.db.execute(`update sessions set org_id = '${owner.me.org.id}' where user_id = '${analyst.me.user.id}'`);
    await analyst.agent.get("/v1/webhooks").expect(200);
    await analyst.agent.get(`/v1/webhooks/${endpoint.endpoint.id}/deliveries`).expect(200);
    await analyst.agent.post("/v1/webhooks").send({ url, events: ["alert.created"] }).expect(403);
    await analyst.agent.post(`/v1/webhooks/${endpoint.endpoint.id}/test`).set(...JSON_HEADER).expect(403);

    await h.db.update(memberships).set({ role: "viewer" }).where(eq(memberships.userId, analyst.me.user.id));
    await analyst.agent.get("/v1/webhooks").expect(403);

    const key = (await owner.agent.post("/v1/keys").send({ name: "Everything", scopes: ["read", "screen", "monitor", "travel_rule"] }).expect(201)).body as CreateApiKeyResponse;
    await h.http().get("/v1/webhooks").set("Authorization", `Bearer ${key.secret}`).expect(403);
  });
});

describe("delivery", () => {
  it("delivers a signed screening.completed event", async () => {
    const screening = (await owner.agent.post("/v1/screen").send({ address: SANCTIONED }).expect(200)).body as { id: string };
    expect(await dispatcher.tick()).toEqual({ succeeded: 1, failed: 0 });
    expect(hook.received).toHaveLength(1);

    const [request] = hook.received;
    expect(request!.headers["content-type"]).toBe("application/json");
    expect(request!.headers["user-agent"]).toBe("Hera-Webhooks/1.0");
    expect(verified(request!, endpoint.secret)).toMatchObject({ ok: true });
    expect(verifyWebhookSignature({ payload: request!.body, header: request!.headers["hera-signature"] as string, secret: "whsec_wrong" })).toEqual({ ok: false, reason: "mismatch" });

    const event = JSON.parse(request!.body) as WebhookEvent<{ id: string; decision: string }>;
    expect(event).toMatchObject({ type: "screening.completed", orgId: owner.me.org.id, data: { id: screening.id, decision: "block" } });
    expect(event.id).toMatch(/^evt_/);
    expect(request!.headers["hera-event-id"]).toBe(event.id);

    const [delivery] = await deliveries();
    expect(delivery).toMatchObject({ status: "succeeded", attempts: 1, responseStatus: 200, eventId: event.id, eventType: "screening.completed" });
    expect(await dispatcher.tick()).toEqual({ succeeded: 0, failed: 0 });
  });

  it("emits alert.created, wallet.activity and travel_rule.updated", async () => {
    const wallet = (await owner.agent.post("/v1/wallets").send({ address: SANCTIONED, label: "Ronin" }).expect(201)).body as WalletDto;
    // The chain shows newer activity than we'd recorded.
    await h.db.update(wallets).set({ lastActivityAt: new Date("2026-01-01T00:00:00Z") }).where(eq(wallets.id, wallet.id));
    await owner.agent.post(`/v1/wallets/${wallet.id}/refresh`).set(...JSON_HEADER).expect(200);
    await owner.agent.post(`/v1/wallets/${wallet.id}/refresh`).set(...JSON_HEADER).expect(200); // nothing newer now

    await owner.agent
      .post("/v1/travel-rule/transfers")
      .send({
        direction: "outgoing",
        chain: "evm:1",
        asset: "USDC",
        amount: "10",
        amountUsd: 10,
        jurisdiction: "US",
        originator: { type: "natural", firstName: "A", lastName: "B" },
        originatorAccount: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
        beneficiary: { type: "natural", firstName: "C", lastName: "D" },
        beneficiaryAccount: { address: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3" },
        beneficiaryVasp: null,
      })
      .expect(201);

    expect(await dispatcher.tick()).toEqual({ succeeded: 3, failed: 0 });
    const events = hook.received.map((r) => JSON.parse(r.body) as WebhookEvent<Record<string, unknown>>);
    expect(events.map((e) => e.type).sort()).toEqual(["alert.created", "travel_rule.updated", "wallet.activity"]);
    expect(events.find((e) => e.type === "alert.created")!.data).toMatchObject({ reasonCode: "SANCTIONS_DIRECT", severity: "critical", walletId: wallet.id });
    expect(events.find((e) => e.type === "wallet.activity")!.data).toMatchObject({ wallet: { id: wallet.id, lastActivityAt: "2026-10-01T12:00:00.000Z" }, newTransfers: 1 });
    for (const request of hook.received) expect(verified(request, endpoint.secret).ok).toBe(true);
  });

  it("retries a 500 with backoff, then succeeds and resets the failure count", async () => {
    hook.statuses.push(500);
    const queued = (await owner.agent.post(`/v1/webhooks/${endpoint.endpoint.id}/test`).set(...JSON_HEADER).expect(202)).body as WebhookDeliveryDto;
    expect(queued).toMatchObject({ status: "pending", attempts: 0, eventType: "screening.completed" });

    expect(await dispatcher.tick()).toEqual({ succeeded: 0, failed: 1 });
    const [failed] = await deliveries();
    expect(failed).toMatchObject({ id: queued.id, status: "pending", attempts: 1, responseStatus: 500, error: "receiver says 500" });
    const wait = Date.parse(failed!.nextAttemptAt!) - Date.parse(failed!.lastAttemptAt!);
    expect(wait).toBe(30_000);
    expect(((await owner.agent.get("/v1/webhooks").expect(200)).body as WebhookEndpointDto[])[0]!.failureCount).toBe(1);

    expect(await dispatcher.tick()).toEqual({ succeeded: 0, failed: 0 }); // not due yet
    await makeDue();
    expect(await dispatcher.tick()).toEqual({ succeeded: 1, failed: 0 });
    const [ok] = await deliveries();
    expect(ok).toMatchObject({ status: "succeeded", attempts: 2, responseStatus: 200 });
    expect(JSON.parse(hook.received[1]!.body)).toMatchObject({ data: { test: true } });
    expect(hook.received[0]!.headers["hera-event-id"]).toBe(hook.received[1]!.headers["hera-event-id"]);
    expect(((await owner.agent.get("/v1/webhooks").expect(200)).body as WebhookEndpointDto[])[0]!.failureCount).toBe(0);
  });

  it("gives up after the last attempt", async () => {
    hook.statuses.push(503);
    const queued = (await owner.agent.post(`/v1/webhooks/${endpoint.endpoint.id}/test`).set(...JSON_HEADER).expect(202)).body as WebhookDeliveryDto;
    await h.db.update(webhookDeliveries).set({ attempts: MAX_ATTEMPTS - 1 }).where(eq(webhookDeliveries.id, queued.id));
    await dispatcher.tick();
    const delivery = (await deliveries()).find((d) => d.id === queued.id);
    expect(delivery).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, responseStatus: 503 });
    expect(delivery!.nextAttemptAt).toBeUndefined();
  });

  it("redelivers the same event, byte for byte", async () => {
    const [original] = (await deliveries()).filter((d) => d.status === "succeeded");
    const again = (await owner.agent.post(`/v1/webhooks/deliveries/${original!.id}/redeliver`).set(...JSON_HEADER).expect(202)).body as WebhookDeliveryDto;
    expect(again).toMatchObject({ eventId: original!.eventId, status: "pending", attempts: 0 });
    await dispatcher.tick();
    expect(hook.received[0]!.headers["hera-event-id"]).toBe(original!.eventId);
    await owner.agent.post("/v1/webhooks/deliveries/00000000-0000-4000-8000-000000000000/redeliver").set(...JSON_HEADER).expect(404);
  });

  it("signs with the new secret after rotation", async () => {
    const rotated = (await owner.agent.post(`/v1/webhooks/${endpoint.endpoint.id}/rotate-secret`).set(...JSON_HEADER).expect(200)).body as CreateWebhookResponse;
    expect(rotated.secret).not.toBe(endpoint.secret);
    expect(rotated.endpoint.secretPrefix).toBe(rotated.secret.slice(0, 12));
    await owner.agent.post(`/v1/webhooks/${endpoint.endpoint.id}/test`).set(...JSON_HEADER).expect(202);
    await dispatcher.tick();
    expect(verified(hook.received[0]!, rotated.secret).ok).toBe(true);
    expect(verified(hook.received[0]!, endpoint.secret).ok).toBe(false);
    endpoint = rotated;
  });

  it("auto-disables an endpoint after 20 consecutive failures, and re-enabling resets it", async () => {
    await h.db.update(webhookEndpoints).set({ failureCount: 19 }).where(eq(webhookEndpoints.id, endpoint.endpoint.id));
    hook.statuses.push(500);
    await owner.agent.post(`/v1/webhooks/${endpoint.endpoint.id}/test`).set(...JSON_HEADER).expect(202);
    await dispatcher.tick();

    const [disabled] = (await owner.agent.get("/v1/webhooks").expect(200)).body as WebhookEndpointDto[];
    expect(disabled).toMatchObject({ enabled: false, failureCount: 20 });
    const audit = (await owner.agent.get("/v1/audit?limit=50").expect(200)).body as AuditEventDto[];
    expect(audit.find((e) => e.action === "webhook.disabled")).toMatchObject({ actor: "system", target: endpoint.endpoint.id });

    // Nothing is fanned out to a disabled endpoint, and pending retries wait.
    await owner.agent.post("/v1/screen").send({ address: SANCTIONED }).expect(200);
    await makeDue();
    expect(await dispatcher.tick()).toEqual({ succeeded: 0, failed: 0 });

    const enabled = (await owner.agent.patch(`/v1/webhooks/${endpoint.endpoint.id}`).send({ enabled: true }).expect(200)).body as WebhookEndpointDto;
    expect(enabled).toMatchObject({ enabled: true, failureCount: 0 });
    expect(await dispatcher.tick()).toEqual({ succeeded: 1, failed: 0 }); // the retry resumes
  });

  it("updates and deletes endpoints", async () => {
    const updated = (await owner.agent.patch(`/v1/webhooks/${endpoint.endpoint.id}`).send({ events: ["report.ready"], description: "Reports only" }).expect(200)).body as WebhookEndpointDto;
    expect(updated).toMatchObject({ events: ["report.ready"], description: "Reports only" });
    await owner.agent.post("/v1/screen").send({ address: SANCTIONED }).expect(200);
    expect(await dispatcher.tick()).toEqual({ succeeded: 0, failed: 0 });

    await owner.agent.delete(`/v1/webhooks/${endpoint.endpoint.id}`).set(...JSON_HEADER).expect(204);
    await owner.agent.delete(`/v1/webhooks/${endpoint.endpoint.id}`).set(...JSON_HEADER).expect(404);
    expect((await owner.agent.get("/v1/webhooks").expect(200)).body).toEqual([]);

    const actions = new Set(((await owner.agent.get("/v1/audit?limit=200").expect(200)).body as AuditEventDto[]).map((e) => e.action));
    for (const action of ["webhook.created", "webhook.updated", "webhook.secret_rotated", "webhook.tested", "webhook.redelivered", "webhook.deleted"]) expect(actions, action).toContain(action);
  });

  it("keeps endpoints inside their org", async () => {
    const other = await signedIn(h);
    const theirs = (await other.agent.post("/v1/webhooks").send({ url, events: ["alert.created"] }).expect(201)).body as CreateWebhookResponse;
    await owner.agent.patch(`/v1/webhooks/${theirs.endpoint.id}`).send({ enabled: false }).expect(404);
    await owner.agent.get(`/v1/webhooks/${theirs.endpoint.id}/deliveries`).expect(404);
  });
});
