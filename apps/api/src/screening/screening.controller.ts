import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { type Paginated, type ScreeningResponse, type ScreeningSummaryDto, type SubjectInput, screenRequestSchema } from "@hera/core";
import { AllowApiKey, CurrentPrincipal, MinRole } from "../auth/access.decorators";
import type { Principal } from "../auth/principal";
import { Idempotent } from "../common/idempotency";
import { IdPipe } from "../common/id.pipe";
import { limitQuery } from "../common/query";
import { RateLimit } from "../common/rate-limit";
import { ZodPipe } from "../common/zod.pipe";
import { ScreeningsService } from "./screenings.service";

const screeningsQuery = limitQuery(50, 200);

@Controller()
export class ScreeningController {
  constructor(private readonly screenings: ScreeningsService) {}

  @Post("screen")
  @HttpCode(200)
  @MinRole("analyst")
  @AllowApiKey("screen")
  @RateLimit("screen")
  @Idempotent()
  screen(@CurrentPrincipal() principal: Principal, @Body(new ZodPipe(screenRequestSchema)) body: SubjectInput): Promise<ScreeningResponse> {
    return this.screenings.screen(principal, body);
  }

  @Get("screenings")
  @AllowApiKey("read")
  list(@CurrentPrincipal() principal: Principal, @Query(new ZodPipe(screeningsQuery)) query: { limit: number }): Promise<Paginated<ScreeningSummaryDto>> {
    return this.screenings.list(principal.orgId, query.limit);
  }

  @Get("screenings/:id")
  @AllowApiKey("read")
  get(@CurrentPrincipal() principal: Principal, @Param("id", IdPipe) id: string): Promise<ScreeningResponse> {
    return this.screenings.get(principal.orgId, id);
  }
}
