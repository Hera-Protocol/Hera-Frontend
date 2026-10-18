import { type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { ThrottlerModuleOptions } from "@nestjs/throttler";
import type { AppConfig } from "../config/config";

const RATE_GROUP_KEY = "hera:rate-group";
type RateGroup = "auth" | "screen" | "verify";

/** Put a route in a shared per-IP budget. Routes without a group are not throttled. */
export const RateLimit = (group: RateGroup) => SetMetadata(RATE_GROUP_KEY, group);

function groupOf(context: ExecutionContext): RateGroup | undefined {
  return (Reflect.getMetadata(RATE_GROUP_KEY, context.getHandler()) ?? Reflect.getMetadata(RATE_GROUP_KEY, context.getClass())) as
    | RateGroup
    | undefined;
}

export function throttlerOptions(config: AppConfig): ThrottlerModuleOptions {
  const group = (name: RateGroup, limit: number) => ({
    name,
    ttl: 60_000,
    limit,
    skipIf: (context: ExecutionContext) => groupOf(context) !== name,
  });
  return {
    throttlers: [
      group("auth", config.rateLimits.authPerMinute),
      group("screen", config.rateLimits.screenPerMinute),
      group("verify", config.rateLimits.verifyPerMinute),
    ],
    // One budget per group and IP, shared by every route in the group.
    generateKey: (_context, tracker, name) => `${name}:${tracker}`,
  };
}
