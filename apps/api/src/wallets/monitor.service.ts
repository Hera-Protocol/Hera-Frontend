import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { isNull, lt, or, sql } from "drizzle-orm";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { DATABASE, type Database } from "../db/database";
import { wallets } from "../db/schema";
import { type WalletRow, WalletsService } from "./wallets.service";

const CONCURRENCY = 2;
/** Upper bound per tick, so one slow tick can't snowball. */
const BATCH_SIZE = 200;

/** Periodically rescreens watched wallets whose last check is older than the interval. */
@Injectable()
export class MonitorService implements OnApplicationBootstrap {
  private readonly logger = new Logger("Monitor");
  private running = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly db: Database,
    private readonly wallets: WalletsService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const interval = this.config.monitorIntervalMs;
    if (interval <= 0 || this.config.env === "test") return;
    this.scheduler.addInterval("wallet-monitor", setInterval(() => void this.tick(), interval));
    this.logger.log(`Rescreening watched wallets every ${Math.round(interval / 1000)}s`);
  }

  /** One pass over stale wallets. Public so it can be triggered directly. */
  async tick(): Promise<{ checked: number; failed: number }> {
    if (this.running) return { checked: 0, failed: 0 };
    this.running = true;
    try {
      const staleBefore = new Date(Date.now() - this.config.monitorIntervalMs);
      const due = await this.db
        .select()
        .from(wallets)
        .where(or(isNull(wallets.lastCheckedAt), lt(wallets.lastCheckedAt, staleBefore)))
        .orderBy(sql`${wallets.lastCheckedAt} asc nulls first`)
        .limit(BATCH_SIZE);
      return await this.drain(due);
    } catch (error) {
      this.logger.error(`Monitor pass failed: ${error instanceof Error ? error.message : String(error)}`);
      return { checked: 0, failed: 0 };
    } finally {
      this.running = false;
    }
  }

  private async drain(queue: WalletRow[]): Promise<{ checked: number; failed: number }> {
    let checked = 0;
    let failed = 0;
    const worker = async () => {
      for (let wallet = queue.shift(); wallet; wallet = queue.shift()) {
        try {
          await this.wallets.rescreen(wallet);
          checked++;
        } catch (error) {
          failed++;
          this.logger.warn(`Rescreen of wallet ${wallet.id} (${wallet.display}) failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return { checked, failed };
  }
}
