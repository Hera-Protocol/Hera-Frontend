export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ChainDataErrorKind = "timeout" | "http" | "network" | "malformed";

export class ChainDataError extends Error {
  /** What went wrong: no answer in time, an HTTP error status, no connection, or an unreadable body. */
  readonly kind: ChainDataErrorKind;
  constructor(
    message: string,
    readonly status?: number,
    kind?: ChainDataErrorKind,
  ) {
    super(message);
    this.name = "ChainDataError";
    this.kind = kind ?? (status !== undefined ? "http" : "network");
  }
}

export interface AdapterOptions {
  fetch?: FetchLike;
  /** Per-request timeout. Default 15 s: busy accounts on public Horizon can take over 10 s per page. */
  timeoutMs?: number;
  /**
   * Overall time budget for one adapter call. Pages after the first are only
   * fetched while budget remains. A source that misses the deadline is reported
   * in `profile.window.missing` and `profile.dataStatus: "partial"`; the call
   * only throws when no source answered at all.
   * Defaults: Horizon 20 s, Blockscout 15 s.
   */
  deadlineMs?: number;
  /** Max pages per paged endpoint. Defaults: Horizon 3 × 200 records, Blockscout 2 × 50 per endpoint. */
  maxPages?: number;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

/** Wall-clock budget shared by every request an adapter makes. */
export class Deadline {
  private readonly end: number;
  constructor(ms: number) {
    this.end = Date.now() + ms;
  }
  remaining(): number {
    return Math.max(0, this.end - Date.now());
  }
  /** Request options whose timeout never outlives the deadline. */
  bound<T extends AdapterOptions>(options: T): T {
    return { ...options, timeoutMs: Math.max(1, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, this.remaining())) };
  }
}

/** Below this much remaining budget, starting another page is pointless. */
const MIN_PAGE_BUDGET_MS = 750;

export interface PagedResult<T> {
  pages: T[];
  /** True when the source reported no further pages. */
  complete: boolean;
  truncatedBy?: "page_budget" | "deadline" | "error";
}

/**
 * Follow a paged endpoint. `nextUrl` returns the next page's URL, or null when the
 * page was the last one. The first page is mandatory and its errors propagate;
 * later pages are best-effort within the page budget and the deadline.
 * Returns null when the first page is a 404.
 */
export async function getPaged<T extends object>(
  firstUrl: string,
  nextUrl: (page: T) => string | null,
  options: AdapterOptions & { maxPages: number },
  deadline: Deadline,
): Promise<PagedResult<T> | null> {
  const first = await getJson<T>(firstUrl, deadline.bound(options));
  if (!first) return null;
  const pages: T[] = [first];
  let next = nextUrl(first);
  while (next) {
    if (pages.length >= options.maxPages) return { pages, complete: false, truncatedBy: "page_budget" };
    if (deadline.remaining() < MIN_PAGE_BUDGET_MS) return { pages, complete: false, truncatedBy: "deadline" };
    let page: T | null;
    try {
      page = await getJson<T>(next, deadline.bound(options));
    } catch {
      return { pages, complete: false, truncatedBy: deadline.remaining() < MIN_PAGE_BUDGET_MS ? "deadline" : "error" };
    }
    if (!page) return { pages, complete: false, truncatedBy: "error" };
    pages.push(page);
    next = nextUrl(page);
  }
  return { pages, complete: true };
}

/** Statuses worth one retry: rate limiting and gateway hiccups. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const RETRY_DELAY_MS = 300;
/** A retry is only attempted if at least this much of the request's time budget is left. */
const MIN_RETRY_BUDGET_MS = 1_000;

class RequestTimeout extends Error {
  override name = "TimeoutError";
}

const isTimeout = (error: unknown) => error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

/**
 * Enforce a deadline even if the fetch implementation ignores its AbortSignal
 * (custom fetches, proxies, test stubs). The signal still cancels well-behaved
 * fetches; the race guarantees we stop waiting either way.
 */
function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new RequestTimeout(`timed out after ${ms} ms`));
      reject(new RequestTimeout(`timed out after ${ms} ms`));
    }, Math.max(1, ms));
  });
  return Promise.race([work(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

/**
 * GET JSON; returns null on 404 so callers can model "never seen" explicitly.
 * A fast transient failure (connection reset, 429, 502/503/504) is retried once
 * within the same time budget. Timeouts are not retried: the budget is spent.
 * Errors are ChainDataError with `kind` set.
 */
export async function getJson<T>(url: string, options: AdapterOptions = {}): Promise<T | null> {
  const doFetch = options.fetch ?? fetch;
  const host = new URL(url).host;
  const budget = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();
  const left = () => budget - (Date.now() - started);
  const sleep = () => new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  let response: Response | undefined;
  for (let attempt = 0; ; attempt++) {
    const canRetry = () => attempt === 0 && left() - RETRY_DELAY_MS >= MIN_RETRY_BUDGET_MS;
    try {
      response = await withTimeout((signal) => doFetch(url, { headers: { Accept: "application/json" }, signal }), left());
    } catch (error) {
      const timedOut = isTimeout(error) || left() <= 0;
      if (!timedOut && canRetry()) {
        await sleep();
        continue;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new ChainDataError(
        timedOut ? `${host} did not answer within ${budget} ms` : `Could not reach ${host}: ${reason}`,
        undefined,
        timedOut ? "timeout" : "network",
      );
    }
    if (RETRYABLE_STATUS.has(response.status) && canRetry()) {
      await response.body?.cancel().catch(() => undefined);
      await sleep();
      continue;
    }
    break;
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new ChainDataError(`${host} responded ${response.status}`, response.status, "http");
  const res = response;
  try {
    return (await withTimeout(() => res.json() as Promise<T>, Math.max(1, left()))) as T;
  } catch (error) {
    if (isTimeout(error)) throw new ChainDataError(`${host} did not finish sending within ${budget} ms`, res.status, "timeout");
    const reason = error instanceof Error ? error.message : String(error);
    throw new ChainDataError(`${host} sent an unreadable response: ${reason}`, res.status, "malformed");
  }
}

export async function getText(url: string, options: AdapterOptions = {}): Promise<string | null> {
  const doFetch = options.fetch ?? fetch;
  try {
    return await withTimeout(async (signal) => {
      const response = await doFetch(url, { signal });
      return response.ok ? await response.text() : null;
    }, options.timeoutMs ?? 6_000);
  } catch {
    return null;
  }
}

export type Settled<T> = { ok: true; value: T } | { ok: false; error: ChainDataError };

/** Await a source without letting its failure fail the whole screen. */
export async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error: error instanceof ChainDataError ? error : new ChainDataError(error instanceof Error ? error.message : String(error), undefined, "network") };
  }
}
