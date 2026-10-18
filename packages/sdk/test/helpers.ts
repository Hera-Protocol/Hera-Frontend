import type { Decision, ScreeningResponse } from "@hera/core";
import { vi } from "vitest";
import { Hera, type HeraOptions } from "../src";

export const KEY = "hera_live_abcd2345_s3cr3tS3cr3tS3cr3tS3cr3tS3cr3t-_xyz";
export const BASE = "https://api.test/v1";
export const UUID = "0b9c2c62-5f37-4c8e-9a51-3f0c7c1c0d11";

export const G = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
export const M = "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK";
export const EVM_SANCTIONED = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

type Responder = (call: Call) => Response | Promise<Response>;

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
}

export function apiError(status: number, code: string, message: string, extra: { fields?: Record<string, string>; headers?: Record<string, string> } = {}): Response {
  return json({ error: { code, message, ...(extra.fields ? { fields: extra.fields } : {}) } }, { status, headers: extra.headers });
}

/** A fetch that records calls and answers from a queue (the last responder repeats). */
export function mockFetch(...responders: (Responder | Response)[]) {
  const calls: Call[] = [];
  let i = 0;
  const fn = vi.fn(async (input: string, init: RequestInit = {}) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k] = v));
    const call: Call = {
      url: input,
      method: init.method ?? "GET",
      headers,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      signal: init.signal ?? undefined,
    };
    calls.push(call);
    const r = responders[Math.min(i++, responders.length - 1)];
    if (!r) return json({});
    return typeof r === "function" ? r(call) : r.clone();
  });
  return { fetch: fn, calls };
}

export function client(fetch: HeraOptions["fetch"], options: Partial<HeraOptions> = {}): Hera {
  return new Hera({ apiKey: KEY, baseUrl: BASE, fetch, ...options });
}

export function screening(decision: Decision = "allow", overrides: Partial<ScreeningResponse> = {}): ScreeningResponse {
  const score = decision === "block" ? 100 : decision === "review" ? 55 : 8;
  return {
    id: UUID,
    subject: { chain: "stellar", account: G },
    display: G,
    score,
    band: decision === "block" ? "severe" : decision === "review" ? "high" : "low",
    decision,
    reasons: [
      { code: "NO_HISTORY", points: 0, severity: "info", title: "Informational", detail: "" },
      { code: "FRESH_ACCOUNT", points: 5, severity: "low", title: "Fresh account", detail: "" },
      ...(decision === "block"
        ? [{ code: "SANCTIONS_DIRECT" as const, points: 100, severity: "critical" as const, title: "Sanctioned address", detail: "OFAC SDN" }]
        : []),
    ],
    profile: { exists: true, observedTransfers: 3, fullHistory: true },
    counterparties: [],
    transfers: [],
    stats: { transfers: 3, inbound: 2, outbound: 1, dustFiltered: 0 },
    screenedAt: "2026-10-18T00:00:00.000Z",
    engineVersion: "test",
    ...overrides,
  };
}
