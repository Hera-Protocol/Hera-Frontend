import type { Role } from "@hera/core";

const RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2, owner: 3 };

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}
