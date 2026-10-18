/**
 * app/api/screen/route.ts
 *
 * The browser calls POST /api/screen with { address, memo? }. This handler
 * holds the Hera key, checks who is asking, rate-limits them, and returns only
 * what the UI needs to show: decision, band, score and short reasons.
 *
 * Works on the Node.js runtime (default) and on `export const runtime = "edge"`:
 * the SDK uses only fetch.
 */
import { Hera, HeraError, HeraRateLimitError, HeraValidationError, type ScreeningResponse, type SubjectInput } from "@hera/sdk";

let client: Hera | undefined;
function hera(): Hera {
  // Lazy, so `next build` doesn't need the secret. HERA_API_KEY must NOT be NEXT_PUBLIC_.
  client ??= new Hera({ apiKey: process.env.HERA_API_KEY ?? "", baseUrl: process.env.HERA_BASE_URL || undefined, timeoutMs: 8_000 });
  return client;
}

/** Replace with your auth (NextAuth, Clerk, your session cookie…). Unauthenticated callers must not reach Hera. */
async function currentUserId(request: Request): Promise<string | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)session=([^;]+)/.exec(cookie);
  return match?.[1] ?? null;
}

/** 20 screens per user per minute. In-memory per instance; use Redis/Upstash in production. */
const WINDOW_MS = 60_000;
const LIMIT = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();
function allow(userId: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  return ++bucket.count <= LIMIT;
}

interface ScreenBody {
  address?: unknown;
  memo?: { type?: unknown; value?: unknown };
}

/** What the browser gets. No transfers, counterparties or label sources: those stay on your server. */
export interface PublicScreening {
  decision: ScreeningResponse["decision"];
  band: ScreeningResponse["band"];
  score: number;
  display: string;
  reasons: { code: string; title: string }[];
}

function toPublic(s: ScreeningResponse): PublicScreening {
  return {
    decision: s.decision,
    band: s.band,
    score: s.score,
    display: s.display,
    reasons: s.reasons.filter((r) => r.points > 0).map((r) => ({ code: r.code, title: r.title })),
  };
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const userId = await currentUserId(request);
  if (!userId) return json({ error: "Sign in first." }, 401);
  if (!allow(userId)) return json({ error: "Too many checks. Wait a minute." }, 429);

  let body: ScreenBody;
  try {
    body = (await request.json()) as ScreenBody;
  } catch {
    return json({ error: "Send JSON." }, 400);
  }
  // Accept exactly the fields we expose. Don't forward arbitrary input to Hera.
  if (typeof body.address !== "string" || body.address.length > 128) return json({ error: "Enter an address." }, 422);
  const memoType = body.memo?.type;
  const memo: SubjectInput["memo"] =
    (memoType === "id" || memoType === "text" || memoType === "hash") && typeof body.memo?.value === "string"
      ? { type: memoType, value: body.memo.value }
      : undefined;

  try {
    const result = await hera().screen({ address: body.address, ...(memo ? { memo } : {}) });
    // Keep the full result server-side for your audit trail (result.id links to Hera's record).
    return json(toPublic(result));
  } catch (error) {
    if (error instanceof HeraValidationError) return json({ error: error.message, fields: error.fields }, 422);
    if (error instanceof HeraRateLimitError) return json({ error: "Screening is busy. Try again shortly." }, 503);
    // Auth, network and server errors: log the details, show the user something generic.
    console.error("hera screen failed", error instanceof HeraError ? { code: error.code, status: error.status, requestId: error.requestId } : error);
    return json({ error: "Couldn't check this address right now." }, 502);
  }
}
