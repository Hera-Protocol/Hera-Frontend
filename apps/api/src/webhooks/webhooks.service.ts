import { randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateWebhookInput,
  CreateWebhookResponse,
  UpdateWebhookInput,
  WebhookDeliveryDto,
  WebhookEndpointDto,
  WebhookEvent,
  WebhookEventType,
} from "@hera/core";
import { and, desc, eq, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { actorOf, type UserPrincipal } from "../auth/principal";
import { notFound, validationFailed } from "../common/api-error";
import { toIso } from "../common/query";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { DATABASE, type Database, type Executor } from "../db/database";
import { webhookDeliveries, webhookEndpoints, webhookEvents } from "../db/schema";
import { generateWebhookSecret, openSecret, sealSecret, secretPrefixOf } from "./secret-box";
import { resolvesToBlockedAddress } from "./ssrf";

type EndpointRow = typeof webhookEndpoints.$inferSelect;
type DeliveryRow = typeof webhookDeliveries.$inferSelect;

export function toEndpointDto(row: EndpointRow): WebhookEndpointDto {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    ...(row.description ? { description: row.description } : {}),
    enabled: row.enabled,
    secretPrefix: row.secretPrefix,
    failureCount: row.failureCount,
    ...(row.lastDeliveryAt ? { lastDeliveryAt: toIso(row.lastDeliveryAt) } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toDeliveryDto(row: DeliveryRow): WebhookDeliveryDto {
  return {
    id: row.id,
    endpointId: row.endpointId,
    eventId: row.eventId,
    eventType: row.eventType,
    status: row.status,
    attempts: row.attempts,
    ...(row.responseStatus !== null ? { responseStatus: row.responseStatus } : {}),
    ...(row.error ? { error: row.error } : {}),
    ...(row.nextAttemptAt ? { nextAttemptAt: toIso(row.nextAttemptAt) } : {}),
    ...(row.lastAttemptAt ? { lastAttemptAt: toIso(row.lastAttemptAt) } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

export const newEventId = () => `evt_${randomBytes(18).toString("base64url")}`;

/**
 * Endpoint management plus the outbox. `emit` runs inside the caller's
 * transaction, so an event exists exactly when the change it describes commits;
 * the dispatcher delivers it afterwards.
 */
@Injectable()
export class WebhooksService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  /* ─── Outbox ─────────────────────────────────────── */

  /** Fan an event out to every enabled endpoint in the org that subscribes to it. Returns the event id, if anyone listens. */
  async emit<T>(executor: Executor, orgId: string, type: WebhookEventType, data: T): Promise<string | null> {
    const endpoints = await executor
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.orgId, orgId), eq(webhookEndpoints.enabled, true), sql`${type} = any(${webhookEndpoints.events})`));
    if (endpoints.length === 0) return null;
    const eventId = await this.insertEvent(executor, orgId, type, data);
    await executor.insert(webhookDeliveries).values(
      endpoints.map((endpoint) => ({ orgId, endpointId: endpoint.id, eventId, eventType: type, status: "pending" as const, nextAttemptAt: new Date() })),
    );
    return eventId;
  }

  private async insertEvent<T>(executor: Executor, orgId: string, type: WebhookEventType, data: T): Promise<string> {
    const envelope: WebhookEvent<T> = { id: newEventId(), type, createdAt: new Date().toISOString(), orgId, data };
    await executor.insert(webhookEvents).values({ id: envelope.id, orgId, type, body: JSON.stringify(envelope) });
    return envelope.id;
  }

  /* ─── Endpoints ──────────────────────────────────── */

  async list(orgId: string): Promise<WebhookEndpointDto[]> {
    const rows = await this.db.select().from(webhookEndpoints).where(eq(webhookEndpoints.orgId, orgId)).orderBy(desc(webhookEndpoints.createdAt));
    return rows.map(toEndpointDto);
  }

  async create(user: UserPrincipal, input: CreateWebhookInput): Promise<CreateWebhookResponse> {
    await this.assertDeliverable(input.url);
    const id = randomUUID();
    const secret = generateWebhookSecret();
    const events = [...new Set(input.events)];
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(webhookEndpoints)
        .values({
          id,
          orgId: user.orgId,
          url: input.url,
          events,
          description: input.description || null,
          secretCiphertext: sealSecret(this.config.webhooks.secretKey, secret, id),
          secretPrefix: secretPrefixOf(secret),
          createdBy: user.userId,
        })
        .returning();
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "webhook.created", target: id, metadata: { url: input.url, events } },
        tx,
      );
      return { endpoint: toEndpointDto(row!), secret };
    });
  }

  async update(user: UserPrincipal, id: string, input: UpdateWebhookInput): Promise<WebhookEndpointDto> {
    if (input.url) await this.assertDeliverable(input.url);
    return this.db.transaction(async (tx) => {
      const current = await this.lock(tx, user.orgId, id);
      const reEnabled = input.enabled === true && !current.enabled;
      const [row] = await tx
        .update(webhookEndpoints)
        .set({
          ...(input.url ? { url: input.url } : {}),
          ...(input.events ? { events: [...new Set(input.events)] } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          // Turning an endpoint back on gives it a clean slate.
          ...(reEnabled ? { failureCount: 0 } : {}),
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, id))
        .returning();
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "webhook.updated", target: id, metadata: { ...input, previousUrl: input.url ? current.url : undefined } },
        tx,
      );
      return toEndpointDto(row!);
    });
  }

  async remove(user: UserPrincipal, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await this.lock(tx, user.orgId, id);
      await tx.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
      await this.audit.record({ orgId: user.orgId, actor: actorOf(user), action: "webhook.deleted", target: id, metadata: { url: current.url } }, tx);
    });
  }

  async rotateSecret(user: UserPrincipal, id: string): Promise<CreateWebhookResponse> {
    const secret = generateWebhookSecret();
    return this.db.transaction(async (tx) => {
      await this.lock(tx, user.orgId, id);
      const [row] = await tx
        .update(webhookEndpoints)
        .set({ secretCiphertext: sealSecret(this.config.webhooks.secretKey, secret, id), secretPrefix: secretPrefixOf(secret), updatedAt: new Date() })
        .where(eq(webhookEndpoints.id, id))
        .returning();
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "webhook.secret_rotated", target: id, metadata: { secretPrefix: row!.secretPrefix } },
        tx,
      );
      return { endpoint: toEndpointDto(row!), secret };
    });
  }

  /** Queue the endpoint's first subscribed event type with `{ test: true }`, for this endpoint only. */
  async sendTest(user: UserPrincipal, id: string): Promise<WebhookDeliveryDto> {
    return this.db.transaction(async (tx) => {
      const endpoint = await this.lock(tx, user.orgId, id);
      const type = endpoint.events[0]!;
      const eventId = await this.insertEvent(tx, user.orgId, type, { test: true });
      const [delivery] = await tx
        .insert(webhookDeliveries)
        .values({ orgId: user.orgId, endpointId: id, eventId, eventType: type, status: "pending", nextAttemptAt: new Date() })
        .returning();
      await this.audit.record({ orgId: user.orgId, actor: actorOf(user), action: "webhook.tested", target: id, metadata: { eventId, type } }, tx);
      return toDeliveryDto(delivery!);
    });
  }

  async deliveries(orgId: string, endpointId: string, limit: number): Promise<WebhookDeliveryDto[]> {
    const [endpoint] = await this.db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.orgId, orgId)))
      .limit(1);
    if (!endpoint) throw notFound("That webhook endpoint");
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, endpointId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
    return rows.map(toDeliveryDto);
  }

  /** A new delivery of the same, byte-identical event (same `hera-event-id`), due now. */
  async redeliver(user: UserPrincipal, deliveryId: string): Promise<WebhookDeliveryDto> {
    return this.db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(webhookDeliveries)
        .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.orgId, user.orgId)))
        .limit(1);
      if (!original) throw notFound("That delivery");
      const [delivery] = await tx
        .insert(webhookDeliveries)
        .values({
          orgId: user.orgId,
          endpointId: original.endpointId,
          eventId: original.eventId,
          eventType: original.eventType,
          status: "pending",
          nextAttemptAt: new Date(),
        })
        .returning();
      await this.audit.record(
        { orgId: user.orgId, actor: actorOf(user), action: "webhook.redelivered", target: original.endpointId, metadata: { eventId: original.eventId, from: deliveryId } },
        tx,
      );
      return toDeliveryDto(delivery!);
    });
  }

  /** The plaintext signing secret, for the dispatcher. */
  secretOf(row: Pick<EndpointRow, "id" | "secretCiphertext">): string {
    return openSecret(this.config.webhooks.secretKey, row.secretCiphertext, row.id);
  }

  private async lock(tx: Executor, orgId: string, id: string): Promise<EndpointRow> {
    const [row] = await tx
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.orgId, orgId)))
      .for("update");
    if (!row) throw notFound("That webhook endpoint");
    return row;
  }

  private async assertDeliverable(url: string): Promise<void> {
    if (this.config.env !== "production") return;
    if (await resolvesToBlockedAddress(url)) {
      throw validationFailed({ url: "That URL points at a private, loopback or link-local address. Use a public https URL." });
    }
  }
}
