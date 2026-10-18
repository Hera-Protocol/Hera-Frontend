import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  type CreateWebhookInput,
  type CreateWebhookResponse,
  createWebhookSchema,
  type UpdateWebhookInput,
  updateWebhookSchema,
  type WebhookDeliveryDto,
  type WebhookEndpointDto,
} from "@hera/core";
import { CurrentUser, MinRole } from "../auth/access.decorators";
import type { UserPrincipal } from "../auth/principal";
import { IdPipe } from "../common/id.pipe";
import { limitQuery } from "../common/query";
import { ZodPipe } from "../common/zod.pipe";
import { WebhooksService } from "./webhooks.service";

const deliveriesQuery = limitQuery(50, 200);

/** Dashboard only: admins and owners manage endpoints, analysts can look, viewers and API keys can't. */
@Controller("webhooks")
@MinRole("analyst")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list(@CurrentUser() user: UserPrincipal): Promise<WebhookEndpointDto[]> {
    return this.webhooks.list(user.orgId);
  }

  @Post()
  @MinRole("admin")
  create(@CurrentUser() user: UserPrincipal, @Body(new ZodPipe(createWebhookSchema)) body: CreateWebhookInput): Promise<CreateWebhookResponse> {
    return this.webhooks.create(user, body);
  }

  @Post("deliveries/:id/redeliver")
  @MinRole("admin")
  @HttpCode(202)
  redeliver(@CurrentUser() user: UserPrincipal, @Param("id", IdPipe) id: string): Promise<WebhookDeliveryDto> {
    return this.webhooks.redeliver(user, id);
  }

  @Patch(":id")
  @MinRole("admin")
  update(
    @CurrentUser() user: UserPrincipal,
    @Param("id", IdPipe) id: string,
    @Body(new ZodPipe(updateWebhookSchema)) body: UpdateWebhookInput,
  ): Promise<WebhookEndpointDto> {
    return this.webhooks.update(user, id, body);
  }

  @Delete(":id")
  @MinRole("admin")
  @HttpCode(204)
  async remove(@CurrentUser() user: UserPrincipal, @Param("id", IdPipe) id: string): Promise<void> {
    await this.webhooks.remove(user, id);
  }

  @Post(":id/rotate-secret")
  @MinRole("admin")
  @HttpCode(200)
  rotate(@CurrentUser() user: UserPrincipal, @Param("id", IdPipe) id: string): Promise<CreateWebhookResponse> {
    return this.webhooks.rotateSecret(user, id);
  }

  @Post(":id/test")
  @MinRole("admin")
  @HttpCode(202)
  test(@CurrentUser() user: UserPrincipal, @Param("id", IdPipe) id: string): Promise<WebhookDeliveryDto> {
    return this.webhooks.sendTest(user, id);
  }

  @Get(":id/deliveries")
  deliveries(
    @CurrentUser() user: UserPrincipal,
    @Param("id", IdPipe) id: string,
    @Query(new ZodPipe(deliveriesQuery)) query: { limit: number },
  ): Promise<WebhookDeliveryDto[]> {
    return this.webhooks.deliveries(user.orgId, id, query.limit);
  }
}
