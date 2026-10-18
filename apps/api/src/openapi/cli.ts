/** `pnpm --filter @hera/api openapi`: writes apps/api/openapi.json for the SDK and docs. */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { PACKAGE_ROOT } from "../config/config";
import { buildOpenApiDocument } from "./document";

const target = path.join(PACKAGE_ROOT, "openapi.json");
const document = buildOpenApiDocument();
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${path.relative(process.cwd(), target) || target}: ${Object.keys(document.paths ?? {}).length} paths, ${Object.keys(document.webhooks ?? {}).length} webhooks`);
