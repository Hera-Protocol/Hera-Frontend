import { readFileSync } from "node:fs";
import path from "node:path";
import { type AlertDto, type ApiErrorBody, type ApiKeyScope, type CreateApiKeyResponse, type Paginated, type Role, type ScreeningSummaryDto, type TravelRuleTransferDto, type WalletDto, WEBHOOK_EVENTS } from "@hera/core";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { ModulesContainer } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_KEY_SCOPE_KEY, MIN_ROLE_KEY, PUBLIC_KEY } from "../src/auth/access.decorators";
import { PACKAGE_ROOT } from "../src/config/config";
import { buildOpenApiDocument, toOpenApiPath } from "../src/openapi/document";
import { ROUTES } from "../src/openapi/routes";
import { MIXER_USER, SANCTIONED } from "./chain-stub";
import { createHarness, type Harness, signedIn } from "./harness";

const errorOf = (body: unknown) => (body as ApiErrorBody).error;

let h: Harness;
let owner: Awaited<ReturnType<typeof signedIn>>;

beforeAll(async () => {
  h = await createHarness();
  owner = await signedIn(h, { company: "Platform Co" });
});

afterAll(async () => {
  await h?.close();
});

interface LiveRoute {
  key: string;
  public: boolean;
  minRole: Role;
  apiKey: ApiKeyScope | null;
}

/** Every route Nest registered, with the auth metadata the guard will read. */
function liveRoutes(): LiveRoute[] {
  const routes: LiveRoute[] = [];
  const meta = <T>(key: string, ...targets: object[]): T | undefined => {
    for (const target of targets) {
      const value = Reflect.getMetadata(key, target) as T | undefined;
      if (value !== undefined) return value;
    }
    return undefined;
  };
  for (const module of h.app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new (...args: unknown[]) => object) | null;
      if (!controller) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? "");
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name] as object;
        if (name === "constructor" || typeof handler !== "function") continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (sub === undefined || method === undefined) continue;
        const full = `/v1/${[base, sub].map((p) => p.replace(/^\/|\/$/g, "")).filter(Boolean).join("/")}`;
        routes.push({
          key: `${RequestMethod[method].toLowerCase()} ${full}`,
          public: meta<boolean>(PUBLIC_KEY, handler, controller) ?? false,
          minRole: meta<Role>(MIN_ROLE_KEY, handler, controller) ?? "viewer",
          apiKey: meta<ApiKeyScope>(API_KEY_SCOPE_KEY, handler, controller) ?? null,
        });
      }
    }
  }
  return routes;
}

describe("OpenAPI", () => {
  it("serves a valid 3.1 document publicly", async () => {
    const res = await h.http().get("/v1/openapi.json").expect(200);
    const doc = JSON.parse(res.text) as ReturnType<typeof buildOpenApiDocument>;
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Hera API");
    expect(Object.keys(doc.components!.securitySchemes!)).toEqual(["sessionCookie", "apiKey"]);
    expect(Object.keys(doc.webhooks!).sort()).toEqual([...WEBHOOK_EVENTS].sort());
    expect(doc.components!.schemas).toHaveProperty("ApiErrorBody");

    // Every $ref resolves.
    const refs = [...res.text.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map((m) => m[1]!);
    expect(refs.length).toBeGreaterThan(50);
    for (const ref of new Set(refs)) expect(doc.components!.schemas, ref).toHaveProperty(ref);
  });

  it("documents every controller route, and only those, with matching auth", () => {
    const live = liveRoutes();
    const documented = new Map(ROUTES.map((r) => [`${r.method} ${r.path}`, r]));
    expect(live.map((r) => r.key).sort()).toEqual([...documented.keys()].sort());

    const doc = buildOpenApiDocument();
    for (const route of live) {
      const docRoute = documented.get(route.key)!;
      expect({ key: route.key, public: Boolean(docRoute.public) }).toEqual({ key: route.key, public: route.public });
      // Role and scope only matter once a route isn't public.
      if (!route.public) {
        expect({ key: route.key, minRole: docRoute.minRole ?? "viewer", apiKey: docRoute.apiKey ?? null }).toEqual({ key: route.key, minRole: route.minRole, apiKey: route.apiKey });
      }

      const [method, p] = route.key.split(" ") as [string, string];
      const operation = (doc.paths![toOpenApiPath(p)] as Record<string, Record<string, unknown>>)[method]!;
      expect(operation, route.key).toBeDefined();
      if (!route.public) expect(operation["x-hera-api-key-scope"]).toBe(route.apiKey);
    }
  });

  it("matches the committed apps/api/openapi.json (run `pnpm --filter @hera/api openapi` if this fails)", () => {
    const committed = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, "openapi.json"), "utf8")) as unknown;
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildOpenApiDocument())));
  });
});

describe("x-request-id", () => {
  it("echoes a valid incoming id and generates one otherwise, on every response", async () => {
    const echoed = await h.http().get("/v1/health").set("x-request-id", "sdk-1234.abc").expect(200);
    expect(echoed.headers["x-request-id"]).toBe("sdk-1234.abc");
    const generated = await h.http().get("/v1/health").expect(200);
    expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    const unsafe = await h.http().get("/v1/health").set("x-request-id", "bad id with spaces <script>").expect(200);
    expect(unsafe.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);

    expect((await h.http().get("/v1/nope").expect(404)).headers["x-request-id"]).toBeDefined();
    expect((await h.http().get("/v1/wallets").expect(401)).headers["x-request-id"]).toBeDefined();
    expect((await owner.agent.post("/v1/wallets").type("form").send("a=b").expect(415)).headers["x-request-id"]).toBeDefined();
    expect((await owner.agent.post("/v1/wallets").set("Content-Type", "application/json").send("{bad").expect(400)).headers["x-request-id"]).toBeDefined();
  });
});

describe("chain_not_live", () => {
  it("422s known chains that aren't live, before touching the network", async () => {
    const before = h.chain.calls.length;
    const res = await owner.agent.post("/v1/screen").send({ address: SANCTIONED, chain: "evm:8453" }).expect(422);
    expect(errorOf(res.body)).toMatchObject({ code: "chain_not_live", fields: { chain: expect.stringMatching(/Base/) } });
    expect(errorOf(res.body).message).toMatch(/Base \(evm:8453\)/);
    await owner.agent.post("/v1/wallets").send({ address: SANCTIONED, chain: "evm:8453", label: "Base" }).expect(422);
    expect(h.chain.calls.length).toBe(before);
  });

  it("keeps 502 for real upstream failures", async () => {
    h.chain.outage = true;
    try {
      const res = await owner.agent.post("/v1/screen").send({ address: MIXER_USER }).expect(502);
      expect(errorOf(res.body).code).toBe("chain_unavailable");
    } finally {
      h.chain.outage = false;
    }
  });
});

describe("monitor scope", () => {
  let monitor: string;
  let readOnly: string;

  beforeAll(async () => {
    monitor = ((await owner.agent.post("/v1/keys").send({ name: "Watchlist sync", scopes: ["monitor"] }).expect(201)).body as CreateApiKeyResponse).secret;
    readOnly = ((await owner.agent.post("/v1/keys").send({ name: "Reader", scopes: ["read"] }).expect(201)).body as CreateApiKeyResponse).secret;
  });

  it("lets monitor keys manage wallets and update alerts", async () => {
    const auth = ["Authorization", `Bearer ${monitor}`] as const;
    const wallet = (await h.http().post("/v1/wallets").set(...auth).send({ address: SANCTIONED, label: "Synced" }).expect(201)).body as WalletDto;
    await h.http().post(`/v1/wallets/${wallet.id}/refresh`).set(...auth).expect(200);

    const [alert] = ((await owner.agent.get("/v1/alerts").expect(200)).body as AlertDto[]).filter((a) => a.walletId === wallet.id);
    const updated = (await h.http().patch(`/v1/alerts/${alert!.id}`).set(...auth).send({ status: "in_review", note: "Picked up by the sync job" }).expect(200)).body as AlertDto;
    expect(updated.notes[0]).toMatchObject({ author: 'API key "Watchlist sync"', body: "Picked up by the sync job" });

    await h.http().get("/v1/wallets").set(...auth).expect(403); // reading needs `read`
    await h.http().delete(`/v1/wallets/${wallet.id}`).set(...auth).expect(204);
  });

  it("refuses those writes to keys without the scope", async () => {
    const auth = ["Authorization", `Bearer ${readOnly}`] as const;
    const res = await h.http().post("/v1/wallets").set(...auth).send({ address: SANCTIONED, label: "Nope" }).expect(403);
    expect(errorOf(res.body).message).toMatch(/"monitor" scope/);
    await h.http().patch("/v1/alerts/00000000-0000-4000-8000-000000000000").set(...auth).send({ status: "in_review" }).expect(403);
  });
});

describe("Idempotency-Key", () => {
  it("replays POST /v1/screen and refuses a different body", async () => {
    const key = `screen-${Date.now()}`;
    const first = await owner.agent.post("/v1/screen").set("Idempotency-Key", key).send({ address: SANCTIONED }).expect(200);
    const second = await owner.agent.post("/v1/screen").set("Idempotency-Key", key).send({ address: SANCTIONED }).expect(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(first.headers["idempotent-replayed"]).toBeUndefined();
    const list = (await owner.agent.get("/v1/screenings?limit=200").expect(200)).body as Paginated<ScreeningSummaryDto>;
    expect(list.items.filter((s) => s.id === first.body.id)).toHaveLength(1);

    const reused = await owner.agent.post("/v1/screen").set("Idempotency-Key", key).send({ address: MIXER_USER }).expect(422);
    expect(errorOf(reused.body).code).toBe("idempotency_key_reused");
    await owner.agent.post("/v1/screen").set("Idempotency-Key", "").send({ address: SANCTIONED }).expect(422);
  });

  it("doesn't store failures, so a retry runs again", async () => {
    const key = `fail-${Date.now()}`;
    await owner.agent.post("/v1/screen").set("Idempotency-Key", key).send({ address: "0x1234" }).expect(422);
    await owner.agent.post("/v1/screen").set("Idempotency-Key", key).send({ address: SANCTIONED }).expect(200);
  });

  it("replays POST /v1/travel-rule/transfers with its 201, scoped per org", async () => {
    const body = {
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
    };
    const first = (await owner.agent.post("/v1/travel-rule/transfers").set("Idempotency-Key", "tr-1").send(body).expect(201)).body as TravelRuleTransferDto;
    const again = await owner.agent.post("/v1/travel-rule/transfers").set("Idempotency-Key", "tr-1").send(body).expect(201);
    expect((again.body as TravelRuleTransferDto).id).toBe(first.id);
    expect((await owner.agent.get("/v1/travel-rule/transfers").expect(200)).body).toHaveLength(1);

    const other = await signedIn(h);
    const theirs = (await other.agent.post("/v1/travel-rule/transfers").set("Idempotency-Key", "tr-1").send(body).expect(201)).body as TravelRuleTransferDto;
    expect(theirs.id).not.toBe(first.id);
  });
});

describe("verify rate limit", () => {
  it("allows 30 a minute per IP by default and answers 429 after", async () => {
    const limited = await createHarness({ rateLimits: { authPerMinute: 10, screenPerMinute: 60, verifyPerMinute: 2 } });
    try {
      const verify = () => limited.http().get(`/v1/reports/verify?sha256=${"0".repeat(64)}`);
      await verify().expect(200);
      await verify().expect(200);
      expect(errorOf((await verify().expect(429)).body).code).toBe("rate_limited");
    } finally {
      await limited.close();
    }
  });
});
