import { Controller, Get, Query } from "@nestjs/common";
import type { AuditEventDto, AuditVerifyResponse } from "@hera/core";
import { CurrentUser } from "../auth/access.decorators";
import type { UserPrincipal } from "../auth/principal";
import { ZodPipe } from "../common/zod.pipe";
import { limitQuery } from "../common/query";
import { AuditService } from "./audit.service";

const auditQuery = limitQuery(100, 500);

@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: UserPrincipal, @Query(new ZodPipe(auditQuery)) query: { limit: number }): Promise<AuditEventDto[]> {
    return this.audit.list(user.orgId, query.limit);
  }

  @Get("verify")
  verify(@CurrentUser() user: UserPrincipal): Promise<AuditVerifyResponse> {
    return this.audit.verify(user.orgId);
  }
}
