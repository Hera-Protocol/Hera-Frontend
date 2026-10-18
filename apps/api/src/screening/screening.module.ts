import { Module } from "@nestjs/common";
import type { FetchLike } from "@hera/core";
import { LabelsService } from "./labels.service";
import { ScreeningController } from "./screening.controller";
import { FETCH, ScreeningEngine } from "./screening.engine";
import { ScreeningsService } from "./screenings.service";

const platformFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

@Module({
  controllers: [ScreeningController],
  providers: [{ provide: FETCH, useValue: platformFetch }, LabelsService, ScreeningEngine, ScreeningsService],
  exports: [ScreeningEngine],
})
export class ScreeningModule {}
