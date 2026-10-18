import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ROUTES } from "./routes";

const OPENAPI = fileURLToPath(new URL("../../../apps/api/openapi.json", import.meta.url));
const present = existsSync(OPENAPI);

if (!present) {
  console.warn(`[contract-drift] skipped: ${OPENAPI} does not exist yet. The API team generates it; rerun once it lands.`);
}

interface Operation {
  "x-hera-api-key-scope"?: string | null;
}
interface OpenApi {
  servers?: { url: string }[];
  paths: Record<string, Record<string, Operation>>;
}

/** `/v1/reports/{id}.pdf` → regex that matches the SDK's template `/reports/{id}.pdf`. */
function normalize(path: string, serverPrefix: string): string {
  let p = path.startsWith(serverPrefix) ? path : `${serverPrefix}${path}`;
  p = p.replace(/^\/v1(?=\/)/, "");
  return p.replace(/\{[^}]+\}/g, "{}").replace(/:([A-Za-z_]+)/g, "{}");
}

describe.skipIf(!present)("SDK ↔ apps/api/openapi.json", () => {
  const spec = present ? (JSON.parse(readFileSync(OPENAPI, "utf8")) as OpenApi) : { paths: {} };
  const serverPrefix = (() => {
    const url = spec.servers?.[0]?.url ?? "";
    const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
    return path.startsWith("/") ? path : "";
  })();
  const operations = new Map<string, Operation>();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(item)) operations.set(`${method.toUpperCase()} ${normalize(path, serverPrefix)}`, op);
  }

  for (const route of ROUTES) {
    const key = `${route.method} ${normalize(route.template, "")}`;
    it(`${route.name}: ${route.method} ${route.template} exists`, () => {
      expect(operations.has(key), `${key} is not in openapi.json. Known: ${[...operations.keys()].sort().join(", ")}`).toBe(true);
    });
    it(`${route.name}: API key scope is ${route.scope ?? "none (session only)"}`, () => {
      const op = operations.get(key);
      if (!op || !("x-hera-api-key-scope" in op)) return; // existence is asserted above; older specs lack the extension
      // If this fails, the API changed who may call the route: update ROUTES, the README's scope table and docs/SDK.md.
      expect(op["x-hera-api-key-scope"] ?? null).toBe(route.scope);
    });
  }
});
