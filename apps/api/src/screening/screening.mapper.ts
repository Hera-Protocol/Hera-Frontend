import type { ScreeningResponse, ScreeningSummaryDto } from "@hera/core";
import type { screenings } from "../db/schema";

type ScreeningRow = typeof screenings.$inferSelect;

export function toScreeningResponse(row: ScreeningRow): ScreeningResponse {
  return { ...row.result, id: row.id };
}

export function toScreeningSummary(row: Pick<ScreeningRow, "id" | "chain" | "display" | "score" | "band" | "decision" | "result" | "createdAt">): ScreeningSummaryDto {
  const topReason = row.result.reasons.find((reason) => reason.points > 0)?.title;
  return {
    id: row.id,
    chain: row.chain,
    display: row.display,
    score: row.score,
    band: row.band,
    decision: row.decision,
    ...(topReason ? { topReason } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}
