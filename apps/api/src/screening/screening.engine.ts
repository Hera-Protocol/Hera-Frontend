import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { CHAINS, ChainDataError, type FetchLike, type ScreeningResult, screenSubject, type SubjectRef, subjectKey } from "@hera/core";
import { ApiError } from "../common/api-error";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { LabelsService } from "./labels.service";
import { LruCache } from "./lru-cache";

/** Injection token for the fetch used to reach Horizon and Blockscout. Tests swap in a stub. */
export const FETCH = Symbol("FETCH");

const CACHE_TTL_MS = 60_000;
const CACHE_ENTRIES = 500;

/**
 * A chain the registry knows but hasn't switched on is the caller's problem
 * (422), not an outage (502), so it's rejected before any network call.
 */
export function assertLive(subject: SubjectRef): void {
  const chain = CHAINS[subject.chain];
  if (chain && !chain.live) {
    throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "chain_not_live", `Live screening isn't enabled for ${chain.name} (${chain.id}) yet. Supported chains are listed at GET /v1/chains.`, {
      chain: `${chain.name} isn't live yet`,
    });
  }
}

/** Chain data plus scoring, with a short cache so bursts of screens don't hammer public APIs. */
@Injectable()
export class ScreeningEngine {
  private readonly cache = new LruCache<ScreeningResult>(CACHE_ENTRIES, CACHE_TTL_MS);

  constructor(
    @Inject(FETCH) private readonly fetch: FetchLike,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly labels: LabelsService,
  ) {}

  /**
   * `fresh` skips the cache, for monitoring and explicit refreshes.
   * `budget: "interactive"` (the default) caps chain paging so a waiting caller
   * gets an answer in about 8 s; `"background"` lets the monitor read as far as core allows.
   */
  async screen(subject: SubjectRef, options: { fresh?: boolean; budget?: "interactive" | "background" } = {}): Promise<ScreeningResult> {
    assertLive(subject);
    const key = subjectKey(subject);
    if (!options.fresh) {
      const cached = this.cache.get(key);
      if (cached) return cached;
    }
    try {
      const result = await screenSubject(subject, {
        labels: this.labels.current(),
        fetch: this.fetch,
        horizonUrl: this.config.horizonUrl,
        ...((options.budget ?? "interactive") === "interactive" ? this.config.interactiveScreen : {}),
      });
      this.cache.set(key, result);
      return result;
    } catch (error) {
      if (error instanceof ChainDataError) throw new ApiError(HttpStatus.BAD_GATEWAY, "chain_unavailable", error.message);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
