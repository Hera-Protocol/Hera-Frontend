import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import {
  type CreateTravelRuleInput,
  createTravelRuleSchema,
  type TravelRuleStatus,
  type TravelRuleTransferDto,
  transitionTravelRuleSchema,
} from "@hera/core";
import { AllowApiKey, CurrentPrincipal, MinRole } from "../auth/access.decorators";
import type { Principal } from "../auth/principal";
import { Idempotent } from "../common/idempotency";
import { IdPipe } from "../common/id.pipe";
import { ZodPipe } from "../common/zod.pipe";
import { TravelRuleService } from "./travel-rule.service";

@Controller("travel-rule/transfers")
@AllowApiKey("travel_rule")
export class TravelRuleController {
  constructor(private readonly travelRule: TravelRuleService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal): Promise<TravelRuleTransferDto[]> {
    return this.travelRule.list(principal.orgId);
  }

  @Get(":id")
  get(@CurrentPrincipal() principal: Principal, @Param("id", IdPipe) id: string): Promise<TravelRuleTransferDto> {
    return this.travelRule.get(principal.orgId, id);
  }

  @Post()
  @MinRole("analyst")
  @Idempotent()
  create(@CurrentPrincipal() principal: Principal, @Body(new ZodPipe(createTravelRuleSchema)) body: CreateTravelRuleInput): Promise<TravelRuleTransferDto> {
    return this.travelRule.create(principal, body);
  }

  @Post(":id/transition")
  @MinRole("analyst")
  @HttpCode(200)
  transition(
    @CurrentPrincipal() principal: Principal,
    @Param("id", IdPipe) id: string,
    @Body(new ZodPipe(transitionTravelRuleSchema)) body: { to: TravelRuleStatus; note?: string },
  ): Promise<TravelRuleTransferDto> {
    return this.travelRule.transition(principal, id, body.to, body.note);
  }
}
