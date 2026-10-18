export type PeriodPreset = "this_quarter" | "last_quarter" | "last_30_days" | "custom";

/** Local calendar date as YYYY-MM-DD (what `<input type="date">` and the API's `z.string().date()` expect). */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function quarterOf(d: Date) {
  return { year: d.getFullYear(), q: Math.floor(d.getMonth() / 3) };
}

export function presetRange(preset: PeriodPreset, now = new Date()): { from: string; to: string } | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { year, q } = quarterOf(today);
  switch (preset) {
    case "this_quarter":
      return { from: isoDate(new Date(year, q * 3, 1)), to: isoDate(today) };
    case "last_quarter": {
      const py = q === 0 ? year - 1 : year;
      const pq = q === 0 ? 3 : q - 1;
      return { from: isoDate(new Date(py, pq * 3, 1)), to: isoDate(new Date(py, pq * 3 + 3, 0)) };
    }
    case "last_30_days":
      return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)), to: isoDate(today) };
    case "custom":
      return null;
  }
}

export function presetLabel(preset: PeriodPreset, now = new Date()): string {
  const { year, q } = quarterOf(now);
  switch (preset) {
    case "this_quarter":
      return `This quarter (Q${q + 1} ${year}, to date)`;
    case "last_quarter":
      return q === 0 ? `Last quarter (Q4 ${year - 1})` : `Last quarter (Q${q} ${year})`;
    case "last_30_days":
      return "Last 30 days";
    case "custom":
      return "Custom range";
  }
}

export const PRESETS: PeriodPreset[] = ["this_quarter", "last_quarter", "last_30_days", "custom"];
