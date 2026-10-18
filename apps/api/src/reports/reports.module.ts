import path from "node:path";
import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { TravelRuleModule } from "../travel-rule/travel-rule.module";
import { ReportJobs } from "./report-jobs.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { LocalDiskReportStorage, REPORT_STORAGE } from "./storage";

@Module({
  imports: [TravelRuleModule],
  controllers: [ReportsController],
  providers: [
    { provide: REPORT_STORAGE, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new LocalDiskReportStorage(path.join(config.dataDir, "reports")) },
    ReportsService,
    ReportJobs,
  ],
  exports: [ReportsService, ReportJobs],
})
export class ReportsModule {}
