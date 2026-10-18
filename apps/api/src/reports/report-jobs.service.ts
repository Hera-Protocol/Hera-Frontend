import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { ReportsService } from "./reports.service";

/**
 * In-process job runner for queued (audit) reports: queued → rendering → ready | failed.
 * Polls on an interval and is also poked right after a report is queued. Off in
 * tests, which call tick() directly. A BullMQ worker can replace it without changing the API.
 */
@Injectable()
export class ReportJobs implements OnApplicationBootstrap {
  private readonly logger = new Logger("ReportJobs");
  private running = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly reports: ReportsService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  private get enabled(): boolean {
    return this.config.reportJobIntervalMs > 0 && this.config.env !== "test";
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    this.scheduler.addInterval("report-jobs", setInterval(() => void this.tick(), this.config.reportJobIntervalMs));
  }

  /** Start work soon without making the request wait for it. */
  poke(): void {
    if (this.enabled) setImmediate(() => void this.tick());
  }

  /** Drain the queue one report at a time. Returns how many reports reached ready or failed. */
  async tick(): Promise<{ ready: number; failed: number }> {
    if (this.running) return { ready: 0, failed: 0 };
    this.running = true;
    const result = { ready: 0, failed: 0 };
    try {
      for (let id = await this.reports.claimQueued(); id; id = await this.reports.claimQueued()) {
        const report = await this.reports.renderQueued(id);
        report.status === "ready" ? result.ready++ : result.failed++;
      }
    } catch (error) {
      this.logger.error(`Report job pass failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
    return result;
  }
}
