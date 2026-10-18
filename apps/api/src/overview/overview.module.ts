import { Module } from "@nestjs/common";
import { AlertsModule } from "../alerts/alerts.module";
import { OverviewController } from "./overview.controller";
import { OverviewService } from "./overview.service";

@Module({ imports: [AlertsModule], controllers: [OverviewController], providers: [OverviewService] })
export class OverviewModule {}
