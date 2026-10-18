import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ALERT_STATUSES, type AlertDto, type AlertStatus, type UpdateAlertInput, updateAlertSchema } from "@hera/core";
import { z } from "zod";
import { AllowApiKey, CurrentPrincipal, MinRole } from "../auth/access.decorators";
import type { Principal } from "../auth/principal";
import { IdPipe } from "../common/id.pipe";
import { ZodPipe } from "../common/zod.pipe";
import { AlertsService } from "./alerts.service";

const alertsQuery = z.object({ status: z.enum(ALERT_STATUSES).optional() });

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @AllowApiKey("read")
  list(@CurrentPrincipal() principal: Principal, @Query(new ZodPipe(alertsQuery)) query: { status?: AlertStatus }): Promise<AlertDto[]> {
    return this.alerts.list(principal.orgId, { status: query.status });
  }

  @Get(":id")
  @AllowApiKey("read")
  get(@CurrentPrincipal() principal: Principal, @Param("id", IdPipe) id: string): Promise<AlertDto> {
    return this.alerts.get(principal.orgId, id);
  }

  @Patch(":id")
  @MinRole("analyst")
  @AllowApiKey("monitor")
  update(
    @CurrentPrincipal() user: Principal,
    @Param("id", IdPipe) id: string,
    @Body(new ZodPipe(updateAlertSchema)) body: UpdateAlertInput,
  ): Promise<AlertDto> {
    return this.alerts.update(user, id, body);
  }
}
