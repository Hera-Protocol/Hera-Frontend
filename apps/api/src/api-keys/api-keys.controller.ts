import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { type ApiKeyDto, type CreateApiKeyInput, type CreateApiKeyResponse, createApiKeySchema } from "@hera/core";
import { CurrentUser, MinRole } from "../auth/access.decorators";
import type { UserPrincipal } from "../auth/principal";
import { IdPipe } from "../common/id.pipe";
import { ZodPipe } from "../common/zod.pipe";
import { ApiKeysService } from "./api-keys.service";

@Controller("keys")
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: UserPrincipal): Promise<ApiKeyDto[]> {
    return this.keys.list(user.orgId);
  }

  @Post()
  @MinRole("admin")
  create(@CurrentUser() user: UserPrincipal, @Body(new ZodPipe(createApiKeySchema)) body: CreateApiKeyInput): Promise<CreateApiKeyResponse> {
    return this.keys.create(user, body);
  }

  @Delete(":id")
  @MinRole("admin")
  @HttpCode(204)
  async revoke(@CurrentUser() user: UserPrincipal, @Param("id", IdPipe) id: string): Promise<void> {
    await this.keys.revoke(user, id);
  }
}
