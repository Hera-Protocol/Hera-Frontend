import { Inject, Injectable } from "@nestjs/common";
import type { ApiKeyDto, CreateApiKeyInput, CreateApiKeyResponse } from "@hera/core";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { ApiKeyPrincipal, UserPrincipal } from "../auth/principal";
import { actorOf } from "../auth/principal";
import { AuditService } from "../audit/audit.service";
import { notFound } from "../common/api-error";
import { toIso } from "../common/query";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { DATABASE, type Database } from "../db/database";
import { apiKeys } from "../db/schema";
import { displayPrefix, generateKey, hashSecret, parseKey, secretMatches } from "./key-format";

/** last_used_at is written at most this often per key. */
const TOUCH_EVERY_MS = 60 * 1000;

type ApiKeyRow = typeof apiKeys.$inferSelect;

function toDto(row: ApiKeyRow): ApiKeyDto {
  return {
    id: row.id,
    name: row.name,
    prefix: displayPrefix(row.prefix),
    scopes: row.scopes,
    createdAt: row.createdAt.toISOString(),
    ...(row.lastUsedAt ? { lastUsedAt: toIso(row.lastUsedAt) } : {}),
    ...(row.revokedAt ? { revokedAt: toIso(row.revokedAt) } : {}),
  };
}

@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string): Promise<ApiKeyDto[]> {
    const rows = await this.db.select().from(apiKeys).where(eq(apiKeys.orgId, orgId)).orderBy(desc(apiKeys.createdAt));
    return rows.map(toDto);
  }

  async create(user: UserPrincipal, input: CreateApiKeyInput): Promise<CreateApiKeyResponse> {
    const generated = generateKey();
    const scopes = [...new Set(input.scopes)];
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(apiKeys)
        .values({
          orgId: user.orgId,
          name: input.name,
          prefix: generated.prefix,
          secretHash: hashSecret(this.config.apiKeyPepper, generated.secret),
          scopes,
          createdBy: user.userId,
        })
        .returning();
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "api_key.created", target: row!.id, metadata: { name: input.name, prefix: displayPrefix(generated.prefix), scopes } },
        tx,
      );
      return { key: toDto(row!), secret: generated.key };
    });
  }

  async revoke(user: UserPrincipal, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, user.orgId), isNull(apiKeys.revokedAt)))
        .returning();
      if (!row) {
        const [existing] = await tx.select({ id: apiKeys.id }).from(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, user.orgId)));
        if (!existing) throw notFound("That API key");
        return; // already revoked: idempotent
      }
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "api_key.revoked", target: row.id, metadata: { name: row.name, prefix: displayPrefix(row.prefix) } },
        tx,
      );
    });
  }

  /** Resolve a Bearer key, or null when it's malformed, unknown, wrong or revoked. */
  async authenticate(presented: string): Promise<ApiKeyPrincipal | null> {
    const parsed = parseKey(presented);
    if (!parsed) return null;
    const [row] = await this.db.select().from(apiKeys).where(eq(apiKeys.prefix, parsed.prefix)).limit(1);
    if (!row || row.revokedAt || !secretMatches(this.config.apiKeyPepper, parsed.secret, row.secretHash)) return null;

    const now = Date.now();
    if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
      await this.db.update(apiKeys).set({ lastUsedAt: new Date(now) }).where(eq(apiKeys.id, row.id));
    }
    return { kind: "api_key", orgId: row.orgId, keyId: row.id, prefix: displayPrefix(row.prefix), name: row.name, scopes: row.scopes };
  }
}
