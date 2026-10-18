import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from "@nestjs/common";
import {
  forgotPasswordSchema,
  type LoginInput,
  loginSchema,
  type MeResponse,
  type MembershipDto,
  type OkResponse,
  type ResetPasswordInput,
  resetPasswordSchema,
  type SignupInput,
  signupSchema,
  switchOrgSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "@hera/core";
import type { Request, Response } from "express";
import { z } from "zod";
import { RateLimit } from "../common/rate-limit";
import { ZodPipe } from "../common/zod.pipe";
import { CurrentUser, Public } from "./access.decorators";
import { AuthService } from "./auth.service";
import type { UserPrincipal } from "./principal";
import { SessionsService } from "./sessions.service";

// Not in @hera/core's contract; see the API README.
const notificationPrefsSchema = z.object({ alertEmails: z.boolean() });

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Post("signup")
  @Public()
  @RateLimit("auth")
  async signup(@Body(new ZodPipe(signupSchema)) body: SignupInput, @Res({ passthrough: true }) res: Response): Promise<MeResponse> {
    const { token, me } = await this.auth.signup(body);
    this.sessions.setCookie(res, token);
    return me;
  }

  @Post("login")
  @Public()
  @RateLimit("auth")
  @HttpCode(200)
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const { token, me } = await this.auth.login(body, req.ip);
    this.sessions.setCookie(res, token);
    return me;
  }

  /** Always succeeds, so a stale cookie can always be cleared. */
  @Post("logout")
  @Public()
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    if (req.principal?.kind === "user") await this.auth.logout(req.principal);
    this.sessions.clearCookie(res);
  }

  @Get("me")
  me(@CurrentUser() user: UserPrincipal): Promise<MeResponse> {
    return this.auth.me(user.userId, user.orgId);
  }

  @Post("forgot-password")
  @Public()
  @RateLimit("auth")
  @HttpCode(202)
  async forgotPassword(@Body(new ZodPipe(forgotPasswordSchema)) body: { email: string }): Promise<OkResponse> {
    await this.auth.forgotPassword(body.email);
    return { ok: true };
  }

  @Post("reset-password")
  @Public()
  @RateLimit("auth")
  @HttpCode(200)
  async resetPassword(@Body(new ZodPipe(resetPasswordSchema)) body: ResetPasswordInput, @Res({ passthrough: true }) res: Response): Promise<OkResponse> {
    await this.auth.resetPassword(body);
    this.sessions.clearCookie(res);
    return { ok: true };
  }

  @Post("verify-email")
  @Public()
  @RateLimit("auth")
  @HttpCode(200)
  async verifyEmail(@Body(new ZodPipe(verifyEmailSchema)) body: { token: string }): Promise<OkResponse> {
    await this.auth.verifyEmail(body.token);
    return { ok: true };
  }

  @Post("resend-verification")
  @RateLimit("auth")
  @HttpCode(202)
  async resendVerification(@CurrentUser() user: UserPrincipal): Promise<OkResponse> {
    await this.auth.resendVerification(user);
    return { ok: true };
  }

  @Post("switch-org")
  @HttpCode(200)
  switchOrg(@CurrentUser() user: UserPrincipal, @Body(new ZodPipe(switchOrgSchema)) body: { orgId: string }): Promise<MeResponse> {
    return this.auth.switchOrg(user, body.orgId.toLowerCase());
  }
}

@Controller("me")
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Patch()
  update(@CurrentUser() user: UserPrincipal, @Body(new ZodPipe(updateProfileSchema)) body: { name: string }): Promise<MeResponse> {
    return this.auth.updateProfile(user, body.name);
  }

  @Get("orgs")
  orgs(@CurrentUser() user: UserPrincipal): Promise<MembershipDto[]> {
    return this.auth.memberships(user.userId);
  }

  @Patch("notifications")
  notifications(@CurrentUser() user: UserPrincipal, @Body(new ZodPipe(notificationPrefsSchema)) body: { alertEmails: boolean }): Promise<{ alertEmails: boolean }> {
    return this.auth.updateNotificationPrefs(user, body.alertEmails);
  }
}
