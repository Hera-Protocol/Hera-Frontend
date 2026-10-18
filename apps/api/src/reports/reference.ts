import { randomInt } from "node:crypto";

// Crockford base32: no I, L, O or U, so references survive being read aloud.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const pad = (n: number) => String(n).padStart(2, "0");

/** `2026Q3` when the range is exactly one calendar quarter, otherwise `<yyyy><mm>` of its start. */
export function periodCode(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  const quarterStart = (fm - 1) % 3 === 0 && fd === 1;
  const quarterEndMonth = fm + 2;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  if (quarterStart && fy === ty && tm === quarterEndMonth && td === lastDay) return `${fy}Q${(fm - 1) / 3 + 1}`;
  return `${fy}${pad(fm)}`;
}

/** `RPT-<period>-<4 base32>`, e.g. RPT-2026Q3-7KX2 or RPT-202610-M3QA. */
export function newReportReference(period: string): string {
  return `RPT-${period}-${Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
}

export const monthCode = (date: Date) => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}`;
