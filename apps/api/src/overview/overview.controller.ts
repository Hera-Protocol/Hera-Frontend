import { Controller, Get } from "@nestjs/common";
import type { OverviewResponse } from "@hera/core";
import { AllowApiKey, CurrentPrincipal } from "../auth/access.decorators";
import type { Principal } from "../auth/principal";
import { OverviewService } from "./overview.service";

@Controller("overview")
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  @AllowApiKey("read")
  get(@CurrentPrincipal() principal: Principal): Promise<OverviewResponse> {
    return this.overview.get(principal.orgId);
  }
}
