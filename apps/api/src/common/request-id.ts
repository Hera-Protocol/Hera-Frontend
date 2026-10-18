import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";
/** Echo a caller's id only if it's a sane token, so logs can't be injected into. */
const ACCEPTABLE = /^[A-Za-z0-9._:-]{1,128}$/;

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/** Every response carries `x-request-id`: the caller's, if it sent a valid one, otherwise a fresh uuid. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id = typeof incoming === "string" && ACCEPTABLE.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
