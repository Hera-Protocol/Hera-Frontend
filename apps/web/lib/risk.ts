import type { Decision, RiskBand } from "@hera/core";

/** Tailwind classes per risk band. Risk colors are for risk only. */
export const BAND_STYLE: Record<RiskBand, { soft: string; text: string; solid: string; ring: string; label: string; stamp: string }> = {
  low: { soft: "bg-risk-low-soft", text: "text-risk-low", solid: "bg-risk-low", ring: "var(--risk-low)", label: "Low", stamp: "CLEAR" },
  medium: { soft: "bg-risk-medium-soft", text: "text-risk-medium", solid: "bg-risk-medium", ring: "var(--risk-medium)", label: "Medium", stamp: "MONITOR" },
  high: { soft: "bg-risk-high-soft", text: "text-risk-high", solid: "bg-risk-high", ring: "var(--risk-high)", label: "High", stamp: "REVIEW" },
  severe: { soft: "bg-risk-severe-soft", text: "text-risk-severe", solid: "bg-risk-severe", ring: "var(--risk-severe)", label: "Severe", stamp: "BLOCKED" },
};

export const DECISION_STYLE: Record<Decision, string> = {
  allow: "bg-risk-low-soft text-risk-low",
  review: "bg-risk-medium-soft text-risk-medium",
  block: "bg-risk-severe-soft text-risk-severe",
};

export const SEVERITY_STYLE: Record<string, string> = {
  info: "bg-iris-soft text-ink",
  low: "bg-risk-low-soft text-risk-low",
  medium: "bg-risk-medium-soft text-risk-medium",
  high: "bg-risk-high-soft text-risk-high",
  critical: "bg-risk-severe-soft text-risk-severe",
};

export const SEVERITY_DOT: Record<string, string> = {
  low: "bg-risk-low",
  medium: "bg-risk-medium",
  high: "bg-risk-high",
  critical: "bg-risk-severe",
};
