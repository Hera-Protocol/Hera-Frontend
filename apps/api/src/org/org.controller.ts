import { Body, Controller, Get, Patch } from "@nestjs/common";
import { type OrgDetailResponse, updateOrgSchema } from "@hera/core";
import { CurrentUser, MinRole } from "../auth/access.decorators";
import type { UserPrincipal } from "../auth/principal";
import { ZodPipe } from "../common/zod.pipe";
import { OrgService } from "./org.service";

@Controller("org")
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Get()
  get(@CurrentUser() user: UserPrincipal): Promise<OrgDetailResponse> {
    return this.org.get(user.orgId);
  }

  @Patch()
  @MinRole("admin")
  update(@CurrentUser() user: UserPrincipal, @Body(new ZodPipe(updateOrgSchema)) body: { name: string }): Promise<OrgDetailResponse> {
    return this.org.update(user, body.name);
  }
}
