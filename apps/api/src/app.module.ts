import { type DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AlertsModule } from "./alerts/alerts.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { AuditModule } from "./audit/audit.module";
import { AuthGuard } from "./auth/auth.guard";
import { AuthModule } from "./auth/auth.module";
import { ApiExceptionFilter } from "./common/exception.filter";
import { throttlerOptions } from "./common/rate-limit";
import { APP_CONFIG, type AppConfig } from "./config/config";
import { DatabaseModule } from "./db/database.module";
import { MailModule } from "./mail/mail.module";
import { OpenApiModule } from "./openapi/openapi.module";
import { OrgModule } from "./org/org.module";
import { OverviewModule } from "./overview/overview.module";
import { ReportsModule } from "./reports/reports.module";
import { ScreeningModule } from "./screening/screening.module";
import { SystemModule } from "./system/system.module";
import { TeamModule } from "./team/team.module";
import { TravelRuleModule } from "./travel-rule/travel-rule.module";
import { WalletsModule } from "./wallets/wallets.module";
import { WebhooksModule } from "./webhooks/webhooks.module";

@Module({})
export class AppModule {
  /** Config is passed in rather than read from process.env, so tests can build isolated apps. */
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        ScheduleModule.forRoot(),
        ThrottlerModule.forRoot(throttlerOptions(config)),
        DatabaseModule,
        AuditModule,
        MailModule,
        WebhooksModule,
        AuthModule,
        ApiKeysModule,
        SystemModule,
        ScreeningModule,
        WalletsModule,
        AlertsModule,
        TravelRuleModule,
        OrgModule,
        TeamModule,
        OverviewModule,
        ReportsModule,
        OpenApiModule,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        // Throttle first so brute-force attempts are rejected before any credential lookup.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useExisting: AuthGuard },
      ],
      exports: [APP_CONFIG],
    };
  }
}
