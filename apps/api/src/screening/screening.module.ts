import { Logger, Module } from "@nestjs/common";
import { createFailoverFetch, type FetchLike } from "@hera/core";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { LabelsService } from "./labels.service";
import { ScreeningController } from "./screening.controller";
import { FETCH, ScreeningEngine } from "./screening.engine";
import { ScreeningsService } from "./screenings.service";

const logger = new Logger("ChainData");

/** Horizon and Blockscout requests fail over between interchangeable endpoints (see core's createFailoverFetch). */
function chainFetch(config: AppConfig): FetchLike {
  return createFailoverFetch([config.horizonUrls, ...Object.values(config.blockscoutUrls)], {
    onFailover: ({ from, reason }) => logger.warn(`${from} failed (${reason}); trying the next endpoint`),
  });
}

@Module({
  controllers: [ScreeningController],
  providers: [{ provide: FETCH, inject: [APP_CONFIG], useFactory: chainFetch }, LabelsService, ScreeningEngine, ScreeningsService],
  exports: [ScreeningEngine],
})
export class ScreeningModule {}
