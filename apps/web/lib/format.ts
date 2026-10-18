import { formatDistanceToNowStrict } from "./time";

export function timeAgo(iso?: string): string {
  if (!iso) return "never";
  return formatDistanceToNowStrict(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatAmount(amount: string, maxFraction = 4): string {
  const [whole = "0", fraction = ""] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "");
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
