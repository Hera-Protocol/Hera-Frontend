import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { REQUEST_ID_HEADER, requestId } from "./common/request-id";
import type { AppConfig } from "./config/config";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isJson(contentType: string | undefined): boolean {
  return contentType?.split(";")[0]?.trim().toLowerCase() === "application/json";
}

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

/**
 * CSRF defence for cookie sessions: a cross-site form can't send
 * `Content-Type: application/json` without a CORS preflight, and SameSite=Lax
 * covers the rest. Bearer-key callers aren't cookie-authenticated, so they're exempt.
 */
function requireJsonForMutations(req: Request, res: Response, next: NextFunction): void {
  if (MUTATING.has(req.method) && !req.headers.authorization && !isJson(req.headers["content-type"])) {
    sendError(res, 415, "unsupported_media_type", "Send requests with Content-Type: application/json.");
    return;
  }
  next();
}

/** Body parsing with our error shape instead of Express's HTML error page. */
function jsonBody() {
  const parse = express.json({ limit: "256kb" });
  return (req: Request, res: Response, next: NextFunction) =>
    parse(req, res, (error?: unknown) => {
      if (!error) return next();
      const status = (error as { status?: number }).status === 413 ? 413 : 400;
      sendError(res, status, status === 413 ? "payload_too_large" : "invalid_json", status === 413 ? "That request body is too large." : "The request body isn't valid JSON.");
    });
}

/** Everything main.ts and the e2e tests must share. Call before `app.init()`. */
export function configureApp(app: INestApplication, config: AppConfig): void {
  const http = app.getHttpAdapter().getInstance() as express.Express;
  http.disable("x-powered-by");
  http.set("trust proxy", config.trustProxy);

  app.setGlobalPrefix("v1");
  // First, so even CORS, 415 and malformed-JSON responses carry a request id.
  app.use(requestId);
  app.enableCors({ origin: config.webOrigin, credentials: true, exposedHeaders: [REQUEST_ID_HEADER, "idempotent-replayed"] });
  app.use(cookieParser());
  app.use(requireJsonForMutations);
  app.use(jsonBody());
}
