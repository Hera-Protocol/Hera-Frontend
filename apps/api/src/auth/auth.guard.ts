import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ApiKeyScope, Role } from "@hera/core";
import type { Request, Response } from "express";
import { ApiKeysService } from "../api-keys/api-keys.service";
import { forbidden, unauthenticated } from "../common/api-error";
import { API_KEY_SCOPE_KEY, MIN_ROLE_KEY, PUBLIC_KEY } from "./access.decorators";
import type { Principal } from "./principal";
import { roleAtLeast } from "./roles";
import { SessionsService } from "./sessions.service";

/**
 * Resolves the caller from `Authorization: Bearer <api key>` or the session
 * cookie, then enforces the route's role or API key scope.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets);
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Public routes still learn who's calling (logout needs it), but bad credentials never block them.
    const principal = isPublic ? await this.identify(request, response).catch(() => null) : await this.identify(request, response);
    if (principal) request.principal = principal;
    if (isPublic) return true;
    if (!principal) throw unauthenticated();

    if (principal.kind === "api_key") {
      const scope = this.reflector.getAllAndOverride<ApiKeyScope | undefined>(API_KEY_SCOPE_KEY, targets);
      if (!scope) throw forbidden("API keys can't call this endpoint. Use a dashboard session.");
      if (!principal.scopes.includes(scope)) throw forbidden(`This API key is missing the "${scope}" scope.`);
      return true;
    }

    const minRole = this.reflector.getAllAndOverride<Role | undefined>(MIN_ROLE_KEY, targets) ?? "viewer";
    if (!roleAtLeast(principal.role, minRole)) throw forbidden();
    return true;
  }

  private async identify(request: Request, response: Response): Promise<Principal | null> {
    const authorization = request.headers.authorization;
    if (authorization) {
      // An explicit Authorization header wins over any cookie, and a bad one is never ignored.
      const match = /^Bearer\s+(\S+)$/i.exec(authorization);
      const principal = match ? await this.apiKeys.authenticate(match[1]!) : null;
      if (!principal) throw unauthenticated("Invalid or revoked API key.");
      return principal;
    }

    const token = this.sessions.readCookie(request.cookies as Record<string, unknown> | undefined);
    if (!token) return null;
    const session = await this.sessions.resolve(token);
    if (!session) return null;
    if (session.refreshed) this.sessions.setCookie(response, token);
    return session.principal;
  }
}
