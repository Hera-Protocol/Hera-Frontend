import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { type CreateWalletInput, createWalletSchema, type WalletDto } from "@hera/core";
import { AllowApiKey, CurrentPrincipal, MinRole } from "../auth/access.decorators";
import type { Principal } from "../auth/principal";
import { IdPipe } from "../common/id.pipe";
import { ZodPipe } from "../common/zod.pipe";
import { WalletsService } from "./wallets.service";

@Controller("wallets")
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  @AllowApiKey("read")
  list(@CurrentPrincipal() principal: Principal): Promise<WalletDto[]> {
    return this.wallets.list(principal.orgId);
  }

  @Post()
  @MinRole("analyst")
  @AllowApiKey("monitor")
  create(@CurrentPrincipal() principal: Principal, @Body(new ZodPipe(createWalletSchema)) body: CreateWalletInput): Promise<WalletDto> {
    return this.wallets.create(principal, body);
  }

  @Delete(":id")
  @MinRole("analyst")
  @AllowApiKey("monitor")
  @HttpCode(204)
  async remove(@CurrentPrincipal() principal: Principal, @Param("id", IdPipe) id: string): Promise<void> {
    await this.wallets.remove(principal, id);
  }

  @Post(":id/refresh")
  @MinRole("analyst")
  @AllowApiKey("monitor")
  @HttpCode(200)
  refresh(@CurrentPrincipal() principal: Principal, @Param("id", IdPipe) id: string): Promise<WalletDto> {
    return this.wallets.refresh(principal.orgId, id);
  }
}
