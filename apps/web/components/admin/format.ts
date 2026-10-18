const short = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const withYear = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

/** "Sep 2" this year, "Sep 2, 2025" otherwise. */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  return (date.getFullYear() === new Date().getFullYear() ? short : withYear).format(date);
}

/** First n characters of a hash, for tables. */
export const shortHash = (hash: string, n = 8) => hash.slice(0, n);
