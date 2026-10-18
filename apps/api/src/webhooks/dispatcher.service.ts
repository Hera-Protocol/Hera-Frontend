import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { signWebhookPayload, WEBHOOK_EVENT_ID_HEADER, WEBHOOK_SIGNATURE_HEADER } from "@hera/core";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { DATABASE, type Database } from "../db/database";
import { webhookDeliveries, webhookEndpoints, webhookEvents } from "../db/schema";
import { postRaw } from "./http-post";
import { WebhooksService } from "./webhooks.service";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Wait before retry n (after the nth failed attempt). 10 attempts spread over ~24 h, then `failed`. */
export const RETRY_BACKOFF_MS = [30 * SECOND, 2 * MINUTE, 10 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR, 4 * HOUR, 8 * HOUR, 8 * HOUR];
export const MAX_ATTEMPTS = RETRY_BACKOFF_MS.length + 1;
/** Consecutive failed attempts before an endpoint is switched off. */
export const AUTO_DISABLE_AFTER = 20;
export const DELIVERY_TIMEOUT_MS = 10 * SECOND;
/** A claimed delivery is invisible to other workers for this long; a crash mid-send means a retry, not a loss. */
const CLAIM_LEASE_MS = 2 * MINUTE;
const BATCH_SIZE = 25;
const CONCURRENCY = 4;

export interface DispatchResult {
  succeeded: number;
  failed: number;
}

/**
 * Polls the outbox and POSTs due deliveries. Claims use `FOR UPDATE SKIP LOCKED`
 * plus a short lease, so several API instances can run it against one Postgres
 * without double-sending; on single-connection PGlite the same SQL simply never contends.
 */
@Injectable()
export class WebhookDispatcher implements OnApplicationBootstrap {
  private readonly logger = new Logger("Webhooks");
  private running = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly db: Database,
    private readonly webhooks: WebhooksService,
    private readonly audit: AuditService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const interval = this.config.webhooks.dispatchIntervalMs;
    if (interval <= 0 || this.config.env === "test") return;
    this.scheduler.addInterval("webhook-dispatch", setInterval(() => void this.tick(), interval));
    this.logger.log(`Dispatching webhooks every ${interval}ms`);
  }

  /** One pass over due deliveries. Public so tests (and ops) can trigger it. */
  async tick(now = new Date()): Promise<DispatchResult> {
    if (this.running) return { succeeded: 0, failed: 0 };
    this.running = true;
    try {
      const claimed = await this.claim(now);
      const result = { succeeded: 0, failed: 0 };
      const queue = [...claimed];
      const worker = async () => {
        for (let id = queue.shift(); id; id = queue.shift()) {
          try {
            (await this.attempt(id)) ? result.succeeded++ : result.failed++;
          } catch (error) {
            result.failed++;
            this.logger.error(`Delivery ${id} crashed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      return result;
    } catch (error) {
      this.logger.error(`Dispatch pass failed: ${error instanceof Error ? error.message : String(error)}`);
      return { succeeded: 0, failed: 0 };
    } finally {
      this.running = false;
    }
  }

  private claim(now: Date): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select({ id: webhookDeliveries.id })
        .from(webhookDeliveries)
        .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
        .where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, now), eq(webhookEndpoints.enabled, true)))
        .orderBy(asc(webhookDeliveries.nextAttemptAt))
        .limit(BATCH_SIZE)
        .for("update", { of: webhookDeliveries, skipLocked: true });
      if (due.length === 0) return [];
      const ids = due.map((d) => d.id);
      await tx
        .update(webhookDeliveries)
        .set({ nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS) })
        .where(inArray(webhookDeliveries.id, ids));
      return ids;
    });
  }

  /** Send one delivery and record the outcome. Returns whether it succeeded. */
  private async attempt(deliveryId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ delivery: webhookDeliveries, endpoint: webhookEndpoints, body: webhookEvents.body })
      .from(webhookDeliveries)
      .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
      .innerJoin(webhookEvents, eq(webhookEvents.id, webhookDeliveries.eventId))
      .where(eq(webhookDeliveries.id, deliveryId))
      .limit(1);
    if (!row || row.delivery.status !== "pending") return false;
    const { delivery, endpoint, body } = row;

    const result = await postRaw(
      endpoint.url,
      body,
      {
        "Content-Type": "application/json",
        "User-Agent": "Hera-Webhooks/1.0",
        [WEBHOOK_SIGNATURE_HEADER]: signWebhookPayload(this.webhooks.secretOf(endpoint), body),
        [WEBHOOK_EVENT_ID_HEADER]: delivery.eventId,
      },
      { timeoutMs: DELIVERY_TIMEOUT_MS, guard: this.config.env === "production" },
    );

    const at = new Date();
    const attempts = delivery.attempts + 1;
    await this.db.transaction(async (tx) => {
      if (result.ok) {
        await tx
          .update(webhookDeliveries)
          .set({ status: "succeeded", attempts, responseStatus: result.status ?? null, error: null, nextAttemptAt: null, lastAttemptAt: at })
          .where(eq(webhookDeliveries.id, delivery.id));
        await tx.update(webhookEndpoints).set({ failureCount: 0, lastDeliveryAt: at }).where(eq(webhookEndpoints.id, endpoint.id));
        return;
      }

      const exhausted = attempts >= MAX_ATTEMPTS;
      await tx
        .update(webhookDeliveries)
        .set({
          status: exhausted ? "failed" : "pending",
          attempts,
          responseStatus: result.status ?? null,
          error: result.error ?? null,
          nextAttemptAt: exhausted ? null : new Date(at.getTime() + RETRY_BACKOFF_MS[attempts - 1]!),
          lastAttemptAt: at,
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      const [updated] = await tx
        .update(webhookEndpoints)
        .set({ failureCount: sql`${webhookEndpoints.failureCount} + 1`, lastDeliveryAt: at })
        .where(eq(webhookEndpoints.id, endpoint.id))
        .returning({ failureCount: webhookEndpoints.failureCount, enabled: webhookEndpoints.enabled });
      if (updated && updated.enabled && updated.failureCount >= AUTO_DISABLE_AFTER) {
        await tx.update(webhookEndpoints).set({ enabled: false, updatedAt: at }).where(eq(webhookEndpoints.id, endpoint.id));
        await this.audit.record(
          {
            orgId: endpoint.orgId,
            actor: "system",
            action: "webhook.disabled",
            target: endpoint.id,
            metadata: { url: endpoint.url, failureCount: updated.failureCount, lastStatus: result.status ?? null, reason: "consecutive_failures" },
          },
          tx,
        );
        this.logger.warn(`Disabled webhook endpoint ${endpoint.id} (${endpoint.url}) after ${updated.failureCount} consecutive failures`);
      }
    });
    return result.ok;
  }
}
