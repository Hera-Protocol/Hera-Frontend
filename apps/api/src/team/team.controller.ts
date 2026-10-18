import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res } from "@nestjs/common";
import {
  type AcceptInviteInput,
  acceptInviteSchema,
  type CreateInviteInput,
  createInviteSchema,
  type InviteDto,
  type InviteLookupResponse,
  type MeResponse,
  type MemberDto,
  type Role,
  updateMemberSchema,
} from "@hera/core";
import type { Response } from "express";
import { z } from "zod";
import { CurrentUser, MinRole, Public } from "../auth/access.decorators";
import type { UserPrincipal } from "../auth/principal";
import { SessionsService } from "../auth/sessions.service";
import { IdPipe } from "../common/id.pipe";
import { RateLimit } from "../common/rate-limit";
import { ZodPipe } from "../common/zod.pipe";
import { InvitesService } from "./invites.service";
import { MembersService } from "./members.service";

const lookupQuery = z.object({ token: z.string().min(16).max(256) });

@Controller("invites")
export class InvitesController {
  constructor(
    private readonly invites: InvitesService,
    private readonly sessions: SessionsService,
  ) {}

  @Get()
  @MinRole("admin")
  list(@CurrentUser() user: UserPrincipal): Promise<InviteDto[]> {
    return this.invites.list(user.orgId);
  }

  @Post()
  @MinRole("admin")
  create(@CurrentUser() user: UserPrincipal, @Body(new ZodPipe(createInviteSchema)) body: CreateInviteInput): Promise<InviteDto> {
    return this.invites.create(user, body);
  }

  @Get("lookup")
  @Public()
  @RateLimit("auth")
  lookup(@Query(new ZodPipe(lookupQuery)) query: { token: string }): Promise<InviteLookupResponse> {
    return this.invites.lookup(query.token);
  }

  @Post("accept")
  @Public()
  @RateLimit("auth")
  @HttpCode(200)
  async accept(@Body(new ZodPipe(acceptInviteSchema)) body: AcceptInviteInput, @Res({ passthrough: true }) res: Response): Promise<MeResponse> {
    const { token, me } = await this.invites.accept(body);
    this.sessions.setCookie(res, token);
    return me;
  }

  @Delete(":id")
  @MinRole("admin")
  @HttpCode(204)
  async revoke(@CurrentUser() user: UserPrincipal, @Param("id", IdPipe) id: string): Promise<void> {
    await this.invites.revoke(user, id);
  }

  @Post(":id/resend")
  @MinRole("admin")
  @HttpCode(200)
  resend(@CurrentUser() user: UserPrincipal, @Param("id", IdPipe) id: string): Promise<InviteDto> {
    return this.invites.resend(user, id);
  }
}

@Controller("org/members")
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly sessions: SessionsService,
  ) {}

  @Patch(":userId")
  @MinRole("admin")
  update(
    @CurrentUser() user: UserPrincipal,
    @Param("userId", IdPipe) userId: string,
    @Body(new ZodPipe(updateMemberSchema)) body: { role: Role },
  ): Promise<MemberDto> {
    return this.members.updateRole(user, userId, body.role);
  }

  /** Viewers may call this to leave; removing someone else needs admin (checked in the service). */
  @Delete(":userId")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: UserPrincipal,
    @Param("userId", IdPipe) userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.members.remove(user, userId);
    if (userId === user.userId) this.sessions.clearCookie(res);
  }
}
