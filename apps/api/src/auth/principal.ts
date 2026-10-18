import type { ApiKeyScope, Role } from "@hera/core";

export interface UserPrincipal {
  kind: "user";
  orgId: string;
  userId: string;
  role: Role;
  name: string;
  email: string;
  sessionId: string;
}

export interface ApiKeyPrincipal {
  kind: "api_key";
  orgId: string;
  keyId: string;
  /** Display prefix, e.g. `hera_live_ab12cd34`. */
  prefix: string;
  name: string;
  scopes: ApiKeyScope[];
}

export type Principal = UserPrincipal | ApiKeyPrincipal;

/** How a principal is named in the audit log and event histories. */
export function actorOf(principal: Principal): string {
  return principal.kind === "user" ? principal.email : `api_key:${principal.prefix}`;
}

export function actorNameOf(principal: Principal): string {
  return principal.kind === "user" ? principal.name : `API key "${principal.name}"`;
}

export function userIdOf(principal: Principal): string | null {
  return principal.kind === "user" ? principal.userId : null;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by AuthGuard. */
      principal?: Principal;
    }
  }
}
