import type {
  AlertDto,
  ApiErrorBody,
  AuditEventDto,
  CreateApiKeyResponse,
  MeResponse,
  OverviewResponse,
  Paginated,
  ScreeningResponse,
  ScreeningSummaryDto,
  TravelRuleTransferDto,
  WalletDto,
} from "@hera/core";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashToken } from "../src/auth/tokens";
import { auditEvents, memberships, passwordResets, wallets } from "../src/db/schema";
import { MonitorService } from "../src/wallets/monitor.service";
import { MIXER_TX, MIXER_USER, SANCTIONED } from "./chain-stub";
import { createHarness, type Harness, newUser, signedIn } from "./harness";

const JSON_HEADER = ["Content-Type", "application/json"] as const;
const errorOf = (body: unknown) => (body as ApiErrorBody).error;

let h: Harness;
let owner: Awaited<ReturnType<typeof signedIn>>;

beforeAll(async () => {
  h = await createHarness();
  owner = await signedIn(h, { company: "Hera Test Exchange" });
});

afterAll(async () => {
  await h?.close();
});

describe("system", () => {
  it("is healthy and lists chains without auth", async () => {
    await h.http().get("/v1/health").expect(200, { ok: true });
    const res = await h.http().get("/v1/chains").expect(200);
    expect(res.body).toContainEqual({ id: "stellar", name: "Stellar", family: "stellar", nativeSymbol: "XLM", live: true });
  });

  it("answers unknown routes with the error shape", async () => {
    const res = await h.http().get("/v1/nope").expect(404);
    expect(errorOf(res.body).code).toBe("not_found");
  });
});

describe("auth", () => {
  it("signs up, sets an HttpOnly session cookie and returns me", async () => {
    const user = newUser({ name: "Grace Owner", company: "Grace Ltd", plan: "enterprise" });
    const agent = h.agent();
    const res = await agent.post("/v1/auth/signup").send(user).expect(201);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/hera_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const me = (await agent.get("/v1/auth/me").expect(200)).body as MeResponse;
    expect(me.user).toMatchObject({ name: "Grace Owner", email: user.email });
    expect(me.org).toMatchObject({ name: "Grace Ltd", plan: "enterprise" });
    expect(me.role).toBe("owner");
  });

  it("rejects a duplicate email with 409 email_taken", async () => {
    const res = await h.http().post("/v1/auth/signup").send({ ...newUser(), email: owner.user.email.toUpperCase() }).expect(409);
    expect(errorOf(res.body).code).toBe("email_taken");
  });

  it("validates signup fields", async () => {
    const res = await h.http().post("/v1/auth/signup").send({ name: "A", email: "nope", company: "Acme", password: "short" }).expect(422);
    expect(errorOf(res.body).code).toBe("validation_failed");
    expect(Object.keys(errorOf(res.body).fields!)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const wrong = await h.http().post("/v1/auth/login").send({ email: owner.user.email, password: "wrong password 1" }).expect(401);
    const unknown = await h.http().post("/v1/auth/login").send({ email: "nobody@example.com", password: "whatever 123" }).expect(401);
    expect(errorOf(wrong.body)).toEqual({ code: "invalid_credentials", message: errorOf(unknown.body).message });
    expect(errorOf(unknown.body).code).toBe("invalid_credentials");
  });

  it("logs in and out", async () => {
    const agent = h.agent();
    await agent.post("/v1/auth/login").send({ email: owner.user.email, password: owner.user.password }).expect(200);
    await agent.get("/v1/auth/me").expect(200);
    await agent.post("/v1/auth/logout").set(...JSON_HEADER).expect(204);
    await agent.get("/v1/auth/me").expect(401);
  });

  it("returns 401 without a session", async () => {
    const res = await h.http().get("/v1/wallets").expect(401);
    expect(errorOf(res.body).code).toBe("unauthenticated");
  });

  it("rejects mutations that aren't JSON with 415", async () => {
    const form = await owner.agent.post("/v1/wallets").type("form").send("address=0x0&label=x").expect(415);
    expect(errorOf(form.body).code).toBe("unsupported_media_type");
    // Body-less mutations must still declare JSON.
    await owner.agent.post("/v1/auth/logout").expect(415);
  });

  it("updates the profile", async () => {
    const res = await owner.agent.patch("/v1/me").send({ name: "Ada Lovelace" }).expect(200);
    expect((res.body as MeResponse).user.name).toBe("Ada Lovelace");
  });

  it("resets a password and revokes every session", async () => {
    const { agent, user, me } = await signedIn(h);
    await h.http().post("/v1/auth/forgot-password").send({ email: user.email }).expect(202);
    await h.http().post("/v1/auth/forgot-password").send({ email: "ghost@example.com" }).expect(202);

    const bad = await h.http().post("/v1/auth/reset-password").send({ token: "not-a-token", password: "brand new pass 9" }).expect(422);
    expect(errorOf(bad.body).fields).toHaveProperty("token");

    // The real token only reaches the log, so plant one with a known value.
    await h.db.insert(passwordResets).values({ tokenHash: hashToken("known-reset-token-0001"), userId: me.user.id, expiresAt: new Date(Date.now() + 60_000) });
    await h.http().post("/v1/auth/reset-password").send({ token: "known-reset-token-0001", password: "brand new pass 9" }).expect(200);
    await agent.get("/v1/auth/me").expect(401);
    await h.http().post("/v1/auth/reset-password").send({ token: "known-reset-token-0001", password: "another pass 10" }).expect(422);
    await h.http().post("/v1/auth/login").send({ email: user.email, password: "brand new pass 9" }).expect(200);
  });
});

describe("screening", () => {
  it("blocks a sanctioned EVM address", async () => {
    const res = await owner.agent.post("/v1/screen").send({ address: SANCTIONED }).expect(200);
    const result = res.body as ScreeningResponse;
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.decision).toBe("block");
    expect(result.score).toBe(100);
    expect(result.band).toBe("severe");
    expect(result.reasons[0]?.code).toBe("SANCTIONS_DIRECT");
    expect(h.chain.calls.some((url) => url.startsWith(`https://eth.blockscout.com/api/v2/addresses/${SANCTIONED}`))).toBe(true);
  });

  it("serves repeat screens from the cache but still records them", async () => {
    const before = h.chain.calls.length;
    await owner.agent.post("/v1/screen").send({ address: SANCTIONED.toLowerCase() }).expect(200);
    expect(h.chain.calls.length).toBe(before);
  });

  it("422s an invalid address on fields.address", async () => {
    const res = await owner.agent.post("/v1/screen").send({ address: "0x1234" }).expect(422);
    expect(errorOf(res.body).code).toBe("validation_failed");
    expect(errorOf(res.body).fields?.address).toMatch(/40 hex/);
  });

  it("maps chain outages to 502 chain_unavailable for unlabeled subjects", async () => {
    // Labeled subjects are scored on their labels during outages (never fail open);
    // only an unlabeled subject with no chain data at all is a 502.
    h.chain.outage = true;
    try {
      const res = await owner.agent.post("/v1/screen").send({ address: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ" }).expect(502);
      expect(errorOf(res.body).code).toBe("chain_unavailable");
      expect(errorOf(res.body).message).toMatch(/horizon\.stellar\.org responded 503/);
    } finally {
      h.chain.outage = false;
    }
  });

  it("lists and fetches screenings", async () => {
    const list = (await owner.agent.get("/v1/screenings?limit=1").expect(200)).body as Paginated<ScreeningSummaryDto>;
    expect(list.total).toBe(2);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ decision: "block", topReason: "Sanctioned address" });

    const one = (await owner.agent.get(`/v1/screenings/${list.items[0]!.id}`).expect(200)).body as ScreeningResponse;
    expect(one.id).toBe(list.items[0]!.id);
    expect(one.reasons.length).toBeGreaterThan(0);

    await owner.agent.get("/v1/screenings/00000000-0000-0000-0000-000000000000").expect(404);
    await owner.agent.get("/v1/screenings/not-a-uuid").expect(404);
  });

  it("keeps screenings inside their org", async () => {
    const other = await signedIn(h);
    const list = (await other.agent.get("/v1/screenings").expect(200)).body as Paginated<ScreeningSummaryDto>;
    expect(list.total).toBe(0);
    const mine = (await owner.agent.get("/v1/screenings").expect(200)).body as Paginated<ScreeningSummaryDto>;
    await other.agent.get(`/v1/screenings/${mine.items[0]!.id}`).expect(404);
  });
});

describe("wallets and alerts", () => {
  let wallet: WalletDto;
  let alert: AlertDto;

  it("watches a wallet, screening it straight away", async () => {
    const res = await owner.agent.post("/v1/wallets").send({ address: SANCTIONED, label: "Ronin exploiter", customerRef: "cust-9" }).expect(201);
    wallet = res.body as WalletDto;
    expect(wallet).toMatchObject({ label: "Ronin exploiter", customerRef: "cust-9", lastScore: 100, lastBand: "severe", chain: "evm:1" });
    expect(wallet.lastActivityAt).toBe("2026-10-01T12:00:00.000Z");
    expect(wallet.subject).toEqual({ chain: "evm:1", address: SANCTIONED });
  });

  it("409s a wallet that's already watched", async () => {
    const res = await owner.agent.post("/v1/wallets").send({ address: SANCTIONED.toLowerCase(), label: "Again" }).expect(409);
    expect(errorOf(res.body).code).toBe("wallet_exists");
  });

  it("raises one alert per finding, however often the wallet is refreshed", async () => {
    const before = h.chain.calls.length;
    const refreshed = (await owner.agent.post(`/v1/wallets/${wallet.id}/refresh`).set(...JSON_HEADER).expect(200)).body as WalletDto;
    expect(h.chain.calls.length).toBeGreaterThan(before); // refresh bypasses the cache
    expect(Date.parse(refreshed.lastCheckedAt!)).toBeGreaterThanOrEqual(Date.parse(wallet.lastCheckedAt!));
    await owner.agent.post(`/v1/wallets/${wallet.id}/refresh`).set(...JSON_HEADER).expect(200);

    const alerts = (await owner.agent.get("/v1/alerts").expect(200)).body as AlertDto[];
    expect(alerts).toHaveLength(1);
    alert = alerts[0]!;
    expect(alert).toMatchObject({
      walletId: wallet.id,
      walletLabel: "Ronin exploiter",
      reasonCode: "SANCTIONS_DIRECT",
      severity: "critical",
      status: "open",
      score: 100,
      notes: [],
    });
  });

  it("dedupes exposure alerts by transaction hash", async () => {
    const mixer = (await owner.agent.post("/v1/wallets").send({ address: MIXER_USER, label: "Mixer user" }).expect(201)).body as WalletDto;
    await owner.agent.post(`/v1/wallets/${mixer.id}/refresh`).set(...JSON_HEADER).expect(200);
    const alerts = ((await owner.agent.get("/v1/alerts?status=open").expect(200)).body as AlertDto[]).filter((a) => a.walletId === mixer.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ reasonCode: "COUNTERPARTY_EXPOSURE", txHash: MIXER_TX });

    await owner.agent.delete(`/v1/wallets/${mixer.id}`).set(...JSON_HEADER).expect(204);
    const watched = (await owner.agent.get("/v1/wallets").expect(200)).body as WalletDto[];
    expect(watched.map((w) => w.id)).toEqual([wallet.id]);
  });

  it("monitors stale wallets and survives per-wallet failures", async () => {
    const monitor = h.app.get(MonitorService);
    await h.db.update(wallets).set({ lastCheckedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    expect(await monitor.tick()).toEqual({ checked: 1, failed: 0 });
    expect(await monitor.tick()).toEqual({ checked: 0, failed: 0 }); // now fresh

    await h.db.update(wallets).set({ lastCheckedAt: null });
    h.chain.outage = true;
    try {
      // The watched wallet carries a direct label, so an outage still scores it
      // (partial data) instead of failing; unlabeled outages are covered above and in core.
      expect(await monitor.tick()).toEqual({ checked: 1, failed: 0 });
    } finally {
      h.chain.outage = false;
    }
    expect(await monitor.tick()).toEqual({ checked: 0, failed: 0 });
    expect(((await owner.agent.get("/v1/alerts").expect(200)).body as AlertDto[]).filter((a) => a.walletId === wallet.id)).toHaveLength(1);
  });

  it("422s closing an alert without a note", async () => {
    const res = await owner.agent.patch(`/v1/alerts/${alert.id}`).send({ status: "closed", disposition: "true_positive" }).expect(422);
    expect(errorOf(res.body).fields?.note).toMatch(/disposition and a note/);
  });

  it("moves an alert through review and closes it with a note", async () => {
    await owner.agent.patch(`/v1/alerts/${alert.id}`).send({ status: "in_review" }).expect(200);
    const closed = (await owner.agent
      .patch(`/v1/alerts/${alert.id}`)
      .send({ status: "closed", disposition: "true_positive", note: "Confirmed OFAC match, account frozen." })
      .expect(200)).body as AlertDto;
    expect(closed).toMatchObject({ status: "closed", disposition: "true_positive" });
    expect(closed.notes).toEqual([expect.objectContaining({ author: "Ada Lovelace", body: "Confirmed OFAC match, account frozen." })]);

    const fetched = (await owner.agent.get(`/v1/alerts/${alert.id}`).expect(200)).body as AlertDto;
    expect(fetched.notes).toHaveLength(1);
    expect(((await owner.agent.get("/v1/alerts?status=closed").expect(200)).body as AlertDto[]).map((a) => a.id)).toEqual([alert.id]);
    await owner.agent.get("/v1/alerts?status=bogus").expect(422);
  });
});

describe("travel rule", () => {
  const base = {
    direction: "outgoing",
    chain: "evm:1",
    asset: "USDC",
    amount: "250.00",
    amountUsd: 250,
    jurisdiction: "EU",
    originatorAccount: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    beneficiary: { type: "natural", firstName: "Bea", lastName: "Neficiary" },
    beneficiaryAccount: { address: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3" },
    beneficiaryVasp: { name: "Coinbase Europe", lei: "549300ZJ7HSN6TTQ6P20" },
  };
  let transfer: TravelRuleTransferDto;

  it("requires an originator identifier in the EU", async () => {
    const res = await owner.agent
      .post("/v1/travel-rule/transfers")
      .send({ ...base, originator: { type: "natural", firstName: "Olu", lastName: "Originator" } })
      .expect(422);
    expect(errorOf(res.body).fields).toHaveProperty("originator");
  });

  it("422s a malformed account on its own field", async () => {
    const res = await owner.agent
      .post("/v1/travel-rule/transfers")
      .send({ ...base, originator: { type: "natural", firstName: "Olu", lastName: "O", customerId: "C-1" }, beneficiaryAccount: { address: "0xnope" } })
      .expect(422);
    expect(Object.keys(errorOf(res.body).fields!)).toEqual(["beneficiaryAccount.address"]);
  });

  it("creates a draft when the originator has a customer ID", async () => {
    const res = await owner.agent
      .post("/v1/travel-rule/transfers")
      .send({ ...base, originator: { type: "natural", firstName: "Olu", lastName: "Originator", customerId: "C-1042" } })
      .expect(201);
    transfer = res.body as TravelRuleTransferDto;
    expect(transfer.reference).toMatch(/^TR-[0-9A-Z]{6}$/);
    expect(transfer).toMatchObject({ status: "draft", amount: "250.00", amountUsd: 250, beneficiaryVasp: { name: "Coinbase Europe" } });
    expect(transfer.check.required).toBe(true);
    expect(transfer.originatorAccount).toEqual({ chain: "evm:1", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" });
    expect(transfer.events).toEqual([expect.objectContaining({ status: "draft", actor: "Ada Lovelace" })]);
  });

  it("409s an invalid transition and applies a valid one", async () => {
    const bad = await owner.agent.post(`/v1/travel-rule/transfers/${transfer.id}/transition`).send({ to: "settled" }).expect(409);
    expect(errorOf(bad.body).code).toBe("invalid_transition");

    const moved = (await owner.agent
      .post(`/v1/travel-rule/transfers/${transfer.id}/transition`)
      .send({ to: "awaiting_counterparty", note: "Sent to Coinbase" })
      .expect(200)).body as TravelRuleTransferDto;
    expect(moved.status).toBe("awaiting_counterparty");
    expect(moved.events.map((e) => e.status)).toEqual(["draft", "awaiting_counterparty"]);

    const list = (await owner.agent.get("/v1/travel-rule/transfers").expect(200)).body as TravelRuleTransferDto[];
    expect(list.map((t) => t.id)).toEqual([transfer.id]);
  });
});

describe("API keys", () => {
  let created: CreateApiKeyResponse;

  it("creates a key and shows the secret once", async () => {
    const res = await owner.agent.post("/v1/keys").send({ name: "Checkout service", scopes: ["screen"] }).expect(201);
    created = res.body as CreateApiKeyResponse;
    expect(created.secret).toMatch(/^hera_live_[a-z0-9]{8}_[A-Za-z0-9_-]{43}$/);
    expect(created.key).toMatchObject({ name: "Checkout service", scopes: ["screen"] });
    expect(created.secret.startsWith(created.key.prefix)).toBe(true);
    const list = (await owner.agent.get("/v1/keys").expect(200)).body as unknown[];
    expect(JSON.stringify(list)).not.toContain(created.secret.slice(-20));
  });

  it("screens with a Bearer key and enforces scopes", async () => {
    const auth = ["Authorization", `Bearer ${created.secret}`] as const;
    const res = await h.http().post("/v1/screen").set(...auth).send({ address: SANCTIONED }).expect(200);
    expect((res.body as ScreeningResponse).decision).toBe("block");

    const noScope = await h.http().get("/v1/wallets").set(...auth).expect(403);
    expect(errorOf(noScope.body).code).toBe("forbidden");
    await h.http().get("/v1/keys").set(...auth).expect(403); // dashboard-only

    const keys = (await owner.agent.get("/v1/keys").expect(200)).body as { lastUsedAt?: string }[];
    expect(keys[0]?.lastUsedAt).toBeDefined();
  });

  it("401s a revoked key", async () => {
    await owner.agent.delete(`/v1/keys/${created.key.id}`).set(...JSON_HEADER).expect(204);
    const res = await h.http().post("/v1/screen").set("Authorization", `Bearer ${created.secret}`).send({ address: SANCTIONED }).expect(401);
    expect(errorOf(res.body).code).toBe("unauthenticated");
    await h.http().post("/v1/screen").set("Authorization", "Bearer hera_live_garbage").send({ address: SANCTIONED }).expect(401);
  });
});

describe("roles", () => {
  it("lets a viewer read but not write", async () => {
    const viewer = await signedIn(h);
    await h.db
      .update(memberships)
      .set({ role: "viewer" })
      .where(and(eq(memberships.userId, viewer.me.user.id), eq(memberships.orgId, viewer.me.org.id)));

    await viewer.agent.get("/v1/wallets").expect(200);
    await viewer.agent.get("/v1/overview").expect(200);
    const denied = await viewer.agent.post("/v1/wallets").send({ address: SANCTIONED, label: "Nope" }).expect(403);
    expect(errorOf(denied.body).code).toBe("forbidden");
    await viewer.agent.post("/v1/screen").send({ address: SANCTIONED }).expect(403);
    await viewer.agent.post("/v1/keys").send({ name: "Nope", scopes: ["read"] }).expect(403);
    await viewer.agent.patch("/v1/org").send({ name: "Renamed" }).expect(403);
  });
});

describe("org and overview", () => {
  it("renames the org and lists members", async () => {
    const res = await owner.agent.patch("/v1/org").send({ name: "Hera Exchange Ltd" }).expect(200);
    expect(res.body).toMatchObject({ name: "Hera Exchange Ltd", members: [expect.objectContaining({ email: owner.user.email, role: "owner" })] });
    await owner.agent.get("/v1/org").expect(200);
  });

  it("summarises the org's activity", async () => {
    const overview = (await owner.agent.get("/v1/overview").expect(200)).body as OverviewResponse;
    expect(overview.screeningsTotal).toBe(3);
    expect(overview.screenings24h).toBe(3);
    expect(overview.bandMix).toEqual({ low: 0, medium: 0, high: 0, severe: 3 });
    expect(overview.openAlerts).toBe(1); // the mixer alert outlives its deleted wallet
    expect(overview.watchedWallets).toBe(1);
    expect(overview.travelRuleOpen).toBe(1);
    expect(overview.daily).toHaveLength(14);
    expect(overview.daily.at(-1)).toEqual({ date: new Date().toISOString().slice(0, 10), screenings: 3, flagged: 3 });
    expect(overview.daily.slice(0, -1).every((d) => d.screenings === 0)).toBe(true);
    expect(overview.recentScreenings).toHaveLength(3);
    expect(overview.recentAlerts.length).toBeGreaterThan(0);
  });
});

describe("audit", () => {
  it("records a verifiable hash chain", async () => {
    const events = (await owner.agent.get("/v1/audit?limit=500").expect(200)).body as AuditEventDto[];
    const actions = new Set(events.map((e) => e.action));
    for (const action of [
      "user.signup",
      "user.login",
      "user.logout",
      "screening.created",
      "wallet.created",
      "wallet.deleted",
      "alert.updated",
      "travel_rule.created",
      "travel_rule.transitioned",
      "api_key.created",
      "api_key.revoked",
      "org.updated",
    ]) {
      expect(actions, action).toContain(action);
    }
    expect(events[0]!.seq).toBe(events.length);
    expect(events.at(-1)).toMatchObject({ seq: 1, prevHash: "0".repeat(64), action: "user.signup" });

    const verify = (await owner.agent.get("/v1/audit/verify").expect(200)).body;
    expect(verify).toEqual({ valid: true, checked: events.length });
  });

  it("detects tampering", async () => {
    await h.db
      .update(auditEvents)
      .set({ metadata: { name: "Evil Corp" } })
      .where(and(eq(auditEvents.orgId, owner.me.org.id), eq(auditEvents.action, "org.updated")));
    const verify = (await owner.agent.get("/v1/audit/verify").expect(200)).body;
    expect(verify.valid).toBe(false);
    expect(verify.brokenAt).toBeGreaterThan(1);
  });
});

describe("rate limits", () => {
  it("throttles auth endpoints per IP", async () => {
    const limited = await createHarness({ rateLimits: { authPerMinute: 2, screenPerMinute: 60, verifyPerMinute: 30 } });
    try {
      const login = () => limited.http().post("/v1/auth/login").send({ email: "x@example.com", password: "whatever 1" });
      await login().expect(401);
      await login().expect(401);
      const res = await login().expect(429);
      expect(errorOf(res.body).code).toBe("rate_limited");
      await limited.http().get("/v1/health").expect(200);
    } finally {
      await limited.close();
    }
  });
});
