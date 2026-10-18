import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { ApiKeyScope, Role } from "@hera/core";
import type { Request } from "express";
import { forbidden, unauthenticated } from "../common/api-error";
import type { Principal, UserPrincipal } from "./principal";

export const PUBLIC_KEY = "hera:public";
export const MIN_ROLE_KEY = "hera:min-role";
export const API_KEY_SCOPE_KEY = "hera:api-key-scope";

/** No authentication required. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Minimum membership role for session-authenticated callers. Defaults to viewer. */
export const MinRole = (role: Role) => SetMetadata(MIN_ROLE_KEY, role);

/** Lets `Authorization: Bearer` API keys call this route when they carry the scope. */
export const AllowApiKey = (scope: ApiKeyScope) => SetMetadata(API_KEY_SCOPE_KEY, scope);

export const CurrentPrincipal = createParamDecorator((_: unknown, ctx: ExecutionContext): Principal => {
  const principal = ctx.switchToHttp().getRequest<Request>().principal;
  if (!principal) throw unauthenticated();
  return principal;
});

/** For dashboard-only routes: the signed-in user. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): UserPrincipal => {
  const principal = ctx.switchToHttp().getRequest<Request>().principal;
  if (!principal) throw unauthenticated();
  if (principal.kind !== "user") throw forbidden("This endpoint needs a dashboard session.");
  return principal;
});
