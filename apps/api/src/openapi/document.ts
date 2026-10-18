import { OpenApiGeneratorV31, type RouteConfig } from "@asteasolutions/zod-to-openapi";
import { WEBHOOK_EVENT_ID_HEADER, WEBHOOK_SIGNATURE_HEADER } from "@hera/core";
import { type RouteDoc, ROUTES, WEBHOOK_PAYLOADS } from "./routes";
import { ApiErrorBodySchema, registry } from "./schemas";
import { z } from "./zod";

export const COOKIE_AUTH = "sessionCookie";
export const BEARER_AUTH = "apiKey";

registry.registerComponent("securitySchemes", COOKIE_AUTH, {
  type: "apiKey",
  in: "cookie",
  name: "hera_session",
  description:
    "Dashboard session from POST /v1/auth/login or /signup. Mutations must send `Content-Type: application/json` (CSRF defence). Roles: viewer < analyst < admin < owner; each operation lists its minimum in `x-hera-min-role`.",
});
registry.registerComponent("securitySchemes", BEARER_AUTH, {
  type: "http",
  scheme: "bearer",
  bearerFormat: "hera_live_<prefix>_<secret>",
  description:
    "API key as `Authorization: Bearer hera_live_…`. Keys carry scopes (read, screen, monitor, travel_rule); the scope an operation needs is listed in its security requirement and in `x-hera-api-key-scope`. Keys get 403 on every route without a scope.",
});

const ERRORS: Record<number, string> = {
  400: "Malformed request (e.g. invalid JSON)",
  401: "Missing, invalid or expired credentials",
  403: "Authenticated, but the role or API key scope doesn't allow this",
  404: "Not found (records from other orgs are 404 too)",
  409: "Conflict with the current state",
  410: "Gone (expired or revoked invite)",
  415: "Mutations must send Content-Type: application/json",
  422: "Validation failed; `error.fields` maps each field to its message",
  429: "Rate limited",
  502: "A chain data source is unavailable",
};

function errorStatuses(route: RouteDoc): number[] {
  const statuses = new Set<number>();
  if (!route.public) statuses.add(401).add(403);
  if (route.method !== "get") statuses.add(415);
  if (route.body || route.query) statuses.add(422);
  if (route.body) statuses.add(400);
  if (/:\w+/.test(route.path)) statuses.add(404);
  if (route.rateLimit) statuses.add(429);
  if (route.path === "/v1/screen" || route.path.startsWith("/v1/wallets")) statuses.add(502);
  if (route.path.startsWith("/v1/invites") || route.path.startsWith("/v1/org/members") || route.path === "/v1/wallets") statuses.add(409);
  if (route.path === "/v1/invites/accept") statuses.add(410);
  if (route.idempotent) statuses.add(409);
  if (route.path.includes("/transition")) statuses.add(409);
  return [...statuses].sort();
}

/** `/v1/wallets/:id` → `/v1/wallets/{id}` */
export const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, "{$1}");

function operationId(route: RouteDoc): string {
  const words = route.path
    .replace(/^\/v1\//, "")
    .replace(/\.json$/, "Json")
    .split(/[/-]/)
    .filter(Boolean)
    .map((part) => (part.startsWith(":") ? `By${part.slice(1, 2).toUpperCase()}${part.slice(2)}` : part));
  const camel = words.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join("");
  return `${route.method}${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

const responseHeaders = (idempotent?: boolean) =>
  z.object({
    "x-request-id": z.string().openapi({ description: "Echoes the request's `x-request-id`, or a generated uuid. Quote it when reporting problems." }),
    ...(idempotent ? { "idempotent-replayed": z.literal("true").optional().openapi({ description: "Present when this is a stored response replayed for a repeated Idempotency-Key." }) } : {}),
  });

function toRouteConfig(route: RouteDoc): RouteConfig {
  const pathParams = [...route.path.matchAll(/:(\w+)/g)].map((m) => m[1]!);
  const responses: RouteConfig["responses"] = {};
  for (const response of route.responses) {
    const headers = responseHeaders(route.idempotent);
    responses[String(response.status)] = response.schema
      ? { description: response.description, headers, content: { [response.contentType ?? "application/json"]: { schema: response.schema } } }
      : { description: response.description, headers };
  }
  for (const status of errorStatuses(route)) {
    responses[String(status)] ??= { description: ERRORS[status]!, headers: responseHeaders(), content: { "application/json": { schema: ApiErrorBodySchema } } };
  }

  const security: Record<string, string[]>[] = route.public
    ? []
    : [{ [COOKIE_AUTH]: [] }, ...(route.apiKey ? [{ [BEARER_AUTH]: [route.apiKey] }] : [])];
  const access = route.public
    ? "Public."
    : `Session: ${route.minRole ?? "viewer"} or above. API keys: ${route.apiKey ? `\`${route.apiKey}\` scope` : "not allowed (403)"}.`;

  return {
    method: route.method,
    path: toOpenApiPath(route.path),
    operationId: operationId(route),
    tags: [route.tag],
    summary: route.summary,
    description: [route.description, access, route.rateLimit ? `Rate limit group: ${route.rateLimit}.` : undefined].filter(Boolean).join("\n\n"),
    security,
    ...(route.public ? {} : { "x-hera-min-role": route.minRole ?? "viewer", "x-hera-api-key-scope": route.apiKey ?? null }),
    request: {
      ...(pathParams.length ? { params: z.object(Object.fromEntries(pathParams.map((p) => [p, z.string().uuid()]))) } : {}),
      ...(route.query ? { query: route.query } : {}),
      headers: z.object({
        "x-request-id": z.string().max(128).optional().openapi({ description: "Optional correlation id ([A-Za-z0-9._:-], up to 128 chars), echoed back." }),
        ...(route.idempotent
          ? {
              "idempotency-key": z.string().min(1).max(255).optional().openapi({
                description:
                  "Retries with the same key (per org and route) within 24 h replay the first 2xx response instead of running again. Same key with a different body: 422 idempotency_key_reused. Concurrent duplicate: 409 idempotency_in_progress.",
              }),
            }
          : {}),
      }),
      ...(route.body ? { body: { required: true, content: { "application/json": { schema: route.body } } } } : {}),
    },
    responses,
  };
}

function registerWebhooks(): void {
  const headers = z.object({
    [WEBHOOK_SIGNATURE_HEADER]: z.string().openapi({
      description: "`t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>`. Verify with `verifyWebhookSignature` from @hera/core or the SDK, and reject timestamps older than 5 minutes.",
      example: "t=1792340708,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd",
    }),
    [WEBHOOK_EVENT_ID_HEADER]: z.string().openapi({ description: "The event id (`evt_…`). Redeliveries reuse it, so dedupe on it." }),
  });
  for (const { type, summary, data } of WEBHOOK_PAYLOADS) {
    registry.registerWebhook({
      method: "post",
      path: type,
      operationId: `webhook_${type.replace(".", "_")}`,
      tags: ["Webhooks"],
      summary,
      description:
        "POSTed to every enabled endpoint subscribed to this event, with `User-Agent: Hera-Webhooks/1.0`. Any 2xx within 10 seconds is success. Failures retry after 30s, 2m, 10m, 30m, 1h, 2h, 4h, 8h and 8h (10 attempts over about 24 hours). An endpoint auto-disables after 20 consecutive failed attempts.",
      request: {
        headers,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z.object({
                id: z.string().openapi({ example: "evt_9fK2mQ4xT1bZ7cW3" }),
                type: z.literal(type),
                createdAt: z.string().datetime({ offset: true }),
                orgId: z.string().uuid(),
                data,
              }),
            },
          },
        },
      },
      responses: { "200": { description: "Any 2xx acknowledges the delivery." } },
    });
  }
}

export type OpenAPIObject = ReturnType<OpenApiGeneratorV31["generateDocument"]>;

let cached: OpenAPIObject | undefined;

export function buildOpenApiDocument(): OpenAPIObject {
  if (cached) return cached;
  for (const route of ROUTES) registry.registerPath(toRouteConfig(route));
  registerWebhooks();
  cached = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Hera API",
      version: "1.0.0",
      description:
        "KYT, AML screening and Travel Rule for Stellar and EVM chains. Every error is `{ error: { code, message, fields? } }`. Every response carries an `x-request-id` header. All timestamps are ISO 8601 UTC.",
    },
    servers: [{ url: "https://api.heralayer.com", description: "Production" }, { url: "http://localhost:4000", description: "Local development" }],
    tags: ["System", "Auth", "Team", "Screening", "Wallets", "Alerts", "Travel Rule", "API keys", "Audit", "Overview", "Webhooks", "Reports"].map((name) => ({ name })),
  });
  return cached;
}
