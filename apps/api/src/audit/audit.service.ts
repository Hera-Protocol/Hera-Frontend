import { Inject, Injectable } from "@nestjs/common";
import type { AuditEventDto, AuditVerifyResponse } from "@hera/core";
import { asc, desc, eq } from "drizzle-orm";
import { DATABASE, type Database, type Executor } from "../db/database";
import { auditEvents, orgs } from "../db/schema";
import { auditHash, GENESIS_HASH } from "./hash-chain";

export interface AuditEntry {
  orgId: string;
  actor: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
}

type AuditRow = typeof auditEvents.$inferSelect;

function toDto(row: AuditRow): AuditEventDto {
  return {
    id: row.id,
    seq: row.seq,
    actor: row.actor,
    action: row.action,
    ...(row.target ? { target: row.target } : {}),
    metadata: row.metadata,
    hash: row.hash,
    prevHash: row.prevHash,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Append to the org's hash chain. Pass the caller's transaction so the event
   * commits (or rolls back) with the change it describes.
   */
  async record(entry: AuditEntry, executor: Executor = this.db): Promise<void> {
    // Round-trip through JSON so what we hash is exactly what jsonb gives back.
    const metadata = JSON.parse(JSON.stringify(entry.metadata ?? {})) as Record<string, unknown>;

    await executor.transaction(async (tx) => {
      // Lock the org row so concurrent appends can't fork seq or prev_hash.
      await tx.select({ id: orgs.id }).from(orgs).where(eq(orgs.id, entry.orgId)).for("update");
      const [last] = await tx
        .select({ seq: auditEvents.seq, hash: auditEvents.hash })
        .from(auditEvents)
        .where(eq(auditEvents.orgId, entry.orgId))
        .orderBy(desc(auditEvents.seq))
        .limit(1);

      const seq = (last?.seq ?? 0) + 1;
      const prevHash = last?.hash ?? GENESIS_HASH;
      const createdAt = new Date();
      const target = entry.target ?? null;
      const hash = auditHash(prevHash, {
        seq,
        actor: entry.actor,
        action: entry.action,
        target,
        metadata,
        createdAt: createdAt.toISOString(),
      });

      await tx.insert(auditEvents).values({
        orgId: entry.orgId,
        seq,
        actor: entry.actor,
        action: entry.action,
        target,
        metadata,
        prevHash,
        hash,
        createdAt,
      });
    });
  }

  async list(orgId: string, limit: number): Promise<AuditEventDto[]> {
    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.orgId, orgId))
      .orderBy(desc(auditEvents.seq))
      .limit(limit);
    return rows.map(toDto);
  }

  /** Recompute every hash from the start. The first event that doesn't match breaks the chain. */
  async verify(orgId: string): Promise<AuditVerifyResponse> {
    const rows = await this.db.select().from(auditEvents).where(eq(auditEvents.orgId, orgId)).orderBy(asc(auditEvents.seq));

    let prevHash = GENESIS_HASH;
    let checked = 0;
    for (const row of rows) {
      const expected = auditHash(prevHash, {
        seq: row.seq,
        actor: row.actor,
        action: row.action,
        target: row.target,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      });
      if (row.seq !== checked + 1 || row.prevHash !== prevHash || row.hash !== expected) {
        return { valid: false, checked, brokenAt: row.seq };
      }
      prevHash = row.hash;
      checked++;
    }
    return { valid: true, checked };
  }
}
