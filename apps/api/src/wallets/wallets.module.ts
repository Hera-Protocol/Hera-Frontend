import { Module } from "@nestjs/common";
import { AlertsModule } from "../alerts/alerts.module";
import { ScreeningModule } from "../screening/screening.module";
import { MonitorService } from "./monitor.service";
import { WalletsController } from "./wallets.controller";
import { WalletsService } from "./wallets.service";

@Module({
  imports: [ScreeningModule, AlertsModule],
  controllers: [WalletsController],
  providers: [WalletsService, MonitorService],
  exports: [MonitorService],
})
export class WalletsModule {}
