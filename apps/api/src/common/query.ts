import { z } from "zod";

/** `?limit=` with a default and a hard ceiling. */
export const limitQuery = (fallback: number, max: number) =>
  z.object({ limit: z.coerce.number().int().min(1).max(max).default(fallback) });

export const toIso = (date: Date | null | undefined): string | undefined => date?.toISOString();
