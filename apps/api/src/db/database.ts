import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Logger } from "@nestjs/common";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import { PACKAGE_ROOT } from "../config/config";
import * as schema from "./schema";

export const DATABASE = Symbol("DATABASE");

type Schema = typeof schema;

/** Driver-agnostic handle: both node-postgres and PGlite databases satisfy it. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;
export type Transaction = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Anything queries can run on: the database itself or an open transaction. */
export type Executor = Database | Transaction;

export interface DatabaseHandle {
  db: Database;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = path.join(PACKAGE_ROOT, "drizzle");

export async function openDatabase(options: { databaseUrl?: string; pgliteDir: string }): Promise<DatabaseHandle> {
  const logger = new Logger("Database");

  if (options.databaseUrl) {
    const pool = new Pool({ connectionString: options.databaseUrl });
    const db = drizzleNodePg(pool, { schema });
    await migrateNodePg(db, { migrationsFolder: MIGRATIONS_DIR });
    logger.log("Connected to Postgres and applied migrations");
    return { db: db as unknown as Database, close: () => pool.end() };
  }

  const inMemory = options.pgliteDir.startsWith("memory://");
  if (!inMemory) mkdirSync(options.pgliteDir, { recursive: true });
  const client = new PGlite(inMemory ? undefined : options.pgliteDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_DIR });
  if (!inMemory) logger.log(`Using embedded PGlite at ${path.relative(process.cwd(), options.pgliteDir) || "."}`);
  return { db: db as unknown as Database, close: () => client.close() };
}

/** Postgres unique_violation, surfaced the same way by both drivers. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  // drizzle wraps driver errors; the SQLSTATE lives on the cause.
  for (let depth = 0; current && depth < 4; depth++) {
    if (typeof current === "object" && (current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
