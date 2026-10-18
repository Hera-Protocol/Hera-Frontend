import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt } from "drizzle-orm";
import type { CookieOptions, Response } from "express";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { DATABASE, type Database, type Executor } from "../db/database";
import { memberships, sessions, users } from "../db/schema";
import type { UserPrincipal } from "./principal";
import { hashToken, newToken } from "./tokens";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Sliding expiry is refreshed at most this often, to keep reads from turning into writes. */
const REFRESH_EVERY_MS = 60 * 60 * 1000;

export interface ResolvedSession {
  principal: UserPrincipal;
  /** Set when the expiry slid forward and the cookie should be re-issued. */
  refreshed: boolean;
}

@Injectable()
export class SessionsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(userId: string, orgId: string, executor: Executor = this.db): Promise<string> {
    const token = newToken();
    await executor.insert(sessions).values({
      tokenHash: hashToken(token),
      userId,
      orgId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return token;
  }

  async resolve(token: string): Promise<ResolvedSession | null> {
    const now = new Date();
    const [row] = await this.db
      .select({
        sessionId: sessions.id,
        orgId: sessions.orgId,
        lastSeenAt: sessions.lastSeenAt,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      // A removed membership ends the session even before it expires.
      .innerJoin(memberships, and(eq(memberships.userId, sessions.userId), eq(memberships.orgId, sessions.orgId)))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)))
      .limit(1);
    if (!row) return null;

    const refreshed = now.getTime() - row.lastSeenAt.getTime() > REFRESH_EVERY_MS;
    if (refreshed) {
      await this.db
        .update(sessions)
        .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
        .where(eq(sessions.id, row.sessionId));
    }

    return {
      refreshed,
      principal: {
        kind: "user",
        sessionId: row.sessionId,
        orgId: row.orgId,
        userId: row.userId,
        name: row.name,
        email: row.email,
        role: row.role,
      },
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async revokeAllForUser(userId: string, executor: Executor = this.db): Promise<void> {
    await executor.delete(sessions).where(eq(sessions.userId, userId));
  }

  /** A removed member loses every session pointed at that org. */
  async revokeForOrg(userId: string, orgId: string, executor: Executor = this.db): Promise<void> {
    await executor.delete(sessions).where(and(eq(sessions.userId, userId), eq(sessions.orgId, orgId)));
  }

  async moveToOrg(sessionId: string, orgId: string, executor: Executor = this.db): Promise<void> {
    await executor.update(sessions).set({ orgId }).where(eq(sessions.id, sessionId));
  }

  /* ─── Cookie ─────────────────────────────────────── */

  readCookie(cookies: Record<string, unknown> | undefined): string | undefined {
    const value = cookies?.[this.config.sessionCookieName];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  setCookie(res: Response, token: string): void {
    res.cookie(this.config.sessionCookieName, token, { ...this.cookieOptions(), maxAge: SESSION_TTL_MS });
  }

  clearCookie(res: Response): void {
    res.clearCookie(this.config.sessionCookieName, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: "lax", path: "/", secure: this.config.cookieSecure };
  }
}
