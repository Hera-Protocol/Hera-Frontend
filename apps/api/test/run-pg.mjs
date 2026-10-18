// `pnpm --filter @hera/api test:pg`: the whole suite against a real Postgres.
// Starts embedded-postgres in a temp dir on a free port, points the harness at
// it (each test app gets its own fresh database), runs vitest, then stops and
// deletes the cluster.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

/**
 * The platform binaries ship their dylib symlinks as a postinstall step, which
 * pnpm skips unless the package is in onlyBuiltDependencies. Hydrate them here.
 */
function hydrateBinaries() {
  const platformPackage = `@embedded-postgres/${os.platform()}-${os.arch()}`;
  const fromEmbedded = createRequire(import.meta.resolve("embedded-postgres"));
  const root = path.dirname(path.dirname(fromEmbedded.resolve(platformPackage)));
  const lib = path.join(root, "native", "lib");
  const versioned = existsSync(lib) ? readdirSync(lib).filter((f) => /\.\d+\.\d+\.dylib$/.test(f)) : [];
  const missing = versioned.some((f) => !existsSync(path.join(lib, f.replace(/\.\d+\.dylib$/, ".dylib"))));
  const script = path.join(root, "scripts", "hydrate-symlinks.js");
  if (missing && existsSync(script)) {
    console.log(`test:pg: hydrating ${platformPackage} symlinks`);
    execFileSync(process.execPath, [script], { cwd: root, stdio: "inherit" });
  }
}

hydrateBinaries();
const dir = mkdtempSync(path.join(os.tmpdir(), "hera-pg-"));
const port = await freePort();
const pg = new EmbeddedPostgres({ databaseDir: path.join(dir, "data"), user: "hera", password: "hera", port, persistent: false, onLog: () => {} });

let code = 1;
try {
  await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const version = (await client.query("show server_version")).rows[0].server_version;
  await client.end();
  console.log(`test:pg: embedded Postgres ${version} on port ${port}`);
  code = await new Promise((resolve) => {
    const child = spawn("pnpm", ["exec", "vitest", "run", ...process.argv.slice(2)], {
      stdio: "inherit",
      env: { ...process.env, HERA_TEST_PG_URL: `postgres://hera:hera@127.0.0.1:${port}/postgres` },
    });
    child.on("exit", (status) => resolve(status ?? 1));
  });
} catch (error) {
  console.error("test:pg could not start Postgres:", error);
} finally {
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
