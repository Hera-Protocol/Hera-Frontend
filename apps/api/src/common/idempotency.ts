import { createHash } from "node:crypto";
import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  type NestInterceptor,
  UseInterceptors,
} from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import type { Request, Response } from "express";
import { and, eq, lt } from "drizzle-orm";
import { from, lastValueFrom, type Observable } from "rxjs";
import { canonicalJson } from "../audit/hash-chain";
import { DATABASE, type Database } from "../db/database";
import { idempotencyKeys } from "../db/schema";
import { ApiError, conflict } from "./api-error";

export const IDEMPOTENCY_HEADER = "idempotency-key";
export const REPLAYED_HEADER = "idempotent-replayed";
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;

/**
 * `Idempotency-Key` support. The first request with a key claims it (a row
 * with no response yet), runs, and stores its 2xx response for 24 hours.
 * Repeats replay that response with `Idempotent-Replayed: true`. A repeat
 * while the first is still running gets 409; the same key with a different
 * body gets 422. Errors aren't stored, so a failed request can be retried.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const raw = req.headers[IDEMPOTENCY_HEADER];
    if (raw === undefined || !req.principal) return next.handle();
    return from(this.run(req, res, String(raw), context, next));
  }

  private async run(req: Request, res: Response, key: string, context: ExecutionContext, next: CallHandler): Promise<unknown> {
    if (!KEY_PATTERN.test(key)) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "validation_failed", "Idempotency-Key must be 1–255 printable ASCII characters.", {
        "Idempotency-Key": "Invalid key",
      });
    }
    const orgId = req.principal!.orgId;
    const route = `${req.method} ${req.route?.path ?? req.path}`;
    const requestHash = createHash("sha256").update(canonicalJson(req.body ?? {})).digest("hex");
    const scope = and(eq(idempotencyKeys.orgId, orgId), eq(idempotencyKeys.route, route), eq(idempotencyKeys.key, key));

    // Expired keys are free to reuse.
    await this.db.delete(idempotencyKeys).where(and(scope, lt(idempotencyKeys.expiresAt, new Date())));
    const [claimed] = await this.db
      .insert(idempotencyKeys)
      .values({ orgId, route, key, requestHash, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) })
      .onConflictDoNothing()
      .returning({ id: idempotencyKeys.id });

    if (!claimed) {
      const [existing] = await this.db.select().from(idempotencyKeys).where(scope).limit(1);
      if (!existing) throw conflict("idempotency_in_progress", "A request with this Idempotency-Key is in progress. Retry shortly.");
      if (existing.requestHash !== requestHash) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "idempotency_key_reused", "This Idempotency-Key was already used with a different request body.");
      }
      if (existing.responseStatus === null) throw conflict("idempotency_in_progress", "A request with this Idempotency-Key is in progress. Retry shortly.");
      res.status(existing.responseStatus);
      res.setHeader(REPLAYED_HEADER, "true");
      return existing.responseBody;
    }

    try {
      const body = await lastValueFrom(next.handle(), { defaultValue: undefined });
      const status =
        (Reflect.getMetadata(HTTP_CODE_METADATA, context.getHandler()) as number | undefined) ?? (req.method === "POST" ? HttpStatus.CREATED : HttpStatus.OK);
      await this.db
        .update(idempotencyKeys)
        .set({ responseStatus: status, responseBody: (body ?? null) as unknown })
        .where(eq(idempotencyKeys.id, claimed.id));
      return body;
    } catch (error) {
      await this.db.delete(idempotencyKeys).where(eq(idempotencyKeys.id, claimed.id));
      throw error;
    }
  }
}

/** Opt a route into `Idempotency-Key` handling. */
export const Idempotent = () => UseInterceptors(IdempotencyInterceptor);
