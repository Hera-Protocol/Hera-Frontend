import { z } from "zod";

/**
 * Travel Rule thresholds. Shipped as data so compliance can review and orgs
 * can override them. Must be confirmed with counsel before go-live
 * (docs/PLAN.md §7).
 */
export interface Jurisdiction {
  code: string;
  name: string;
  /** Threshold in `currency`, at or above which full originator/beneficiary data is required. 0 = always. */
  threshold: number;
  currency: "USD" | "EUR" | "GBP" | "SGD" | "CAD";
  /** Above this (in `currency`), transfers to or from self-hosted wallets need proof of control. */
  unhostedVerificationAbove?: number;
  reference: string;
}

export const JURISDICTIONS: Jurisdiction[] = [
  { code: "FATF", name: "FATF baseline", threshold: 1000, currency: "USD", reference: "FATF Recommendation 16" },
  { code: "US", name: "United States", threshold: 3000, currency: "USD", reference: "FinCEN, 31 CFR 1010.410(f)" },
  { code: "EU", name: "European Union", threshold: 0, currency: "EUR", unhostedVerificationAbove: 1000, reference: "Regulation (EU) 2023/1113 (TFR)" },
  { code: "UK", name: "United Kingdom", threshold: 1000, currency: "EUR", reference: "MLRs 2017, Part 7A" },
  { code: "SG", name: "Singapore", threshold: 1500, currency: "SGD", reference: "MAS Notice PSN02" },
  { code: "CA", name: "Canada", threshold: 1000, currency: "CAD", reference: "PCMLTFR" },
];

/**
 * Rough conversion so thresholds in other currencies can be compared with a USD amount.
 * Production uses a daily FX feed; these are deliberately round numbers.
 */
const USD_PER: Record<Jurisdiction["currency"], number> = { USD: 1, EUR: 1.08, GBP: 1.27, SGD: 0.74, CAD: 0.73 };

export function getJurisdiction(code: string): Jurisdiction {
  return JURISDICTIONS.find((j) => j.code === code) ?? JURISDICTIONS[0]!;
}

export interface TravelRuleCheck {
  required: boolean;
  thresholdUsd: number;
  unhostedProofRequired: boolean;
  explanation: string;
}

export function checkTravelRule(input: { amountUsd: number; jurisdiction: string; counterpartyHosted: boolean }): TravelRuleCheck {
  const j = getJurisdiction(input.jurisdiction);
  const thresholdUsd = Math.round(j.threshold * USD_PER[j.currency]);
  const required = input.amountUsd >= thresholdUsd;
  const unhostedProofRequired =
    !input.counterpartyHosted &&
    j.unhostedVerificationAbove !== undefined &&
    input.amountUsd > j.unhostedVerificationAbove * USD_PER[j.currency];

  const thresholdText = j.threshold === 0 ? "every transfer" : `${j.currency} ${j.threshold.toLocaleString("en-US")} and above`;
  let explanation = required
    ? `${j.name} requires originator and beneficiary data for ${thresholdText}.`
    : `Below the ${j.name} threshold (${thresholdText}). Collecting the data anyway is still recommended.`;
  if (unhostedProofRequired) {
    explanation += ` The counterparty is a self-hosted wallet above ${j.currency} ${j.unhostedVerificationAbove}, so proof of wallet control is required.`;
  }
  return { required, thresholdUsd, unhostedProofRequired, explanation };
}

/* ─── IVMS101 (the subset Hera collects) ─────────────── */

const nonEmpty = z.string().trim().min(1, "Required");

export const ivmsNaturalPersonSchema = z.object({
  type: z.literal("natural"),
  firstName: nonEmpty,
  lastName: nonEmpty,
  /** At least one identifying detail beyond the name is required by FATF R.16. */
  dateOfBirth: z.string().optional(),
  placeOfBirth: z.string().optional(),
  nationalId: z.string().optional(),
  customerId: z.string().optional(),
  address: z.object({ street: z.string().optional(), city: z.string().optional(), country: z.string().length(2).optional() }).optional(),
});

export const ivmsLegalPersonSchema = z.object({
  type: z.literal("legal"),
  legalName: nonEmpty,
  lei: z.string().regex(/^[A-Z0-9]{18}\d{2}$/, "LEI is 20 characters").optional().or(z.literal("")),
  customerId: z.string().optional(),
  address: z.object({ street: z.string().optional(), city: z.string().optional(), country: z.string().length(2).optional() }).optional(),
});

export const ivmsPersonSchema = z.discriminatedUnion("type", [ivmsNaturalPersonSchema, ivmsLegalPersonSchema]);
export type IvmsPerson = z.infer<typeof ivmsPersonSchema>;

export const vaspSchema = z.object({
  name: nonEmpty,
  lei: z.string().optional(),
  /** Stellar: home domain used to discover the VASP via stellar.toml. */
  domain: z.string().optional(),
});

/** FATF R.16: the originator needs an address, national ID, customer ID, or date + place of birth. */
export function originatorHasIdentifier(person: IvmsPerson): boolean {
  if (person.customerId?.trim()) return true;
  if (person.address?.country && (person.address.city || person.address.street)) return true;
  if (person.type === "natural") {
    if (person.nationalId?.trim()) return true;
    if (person.dateOfBirth && person.placeOfBirth?.trim()) return true;
  }
  return false;
}

export const TRAVEL_RULE_STATUSES = [
  "draft",
  "awaiting_counterparty",
  "acknowledged",
  "accepted",
  "rejected",
  "unhosted_verification",
  "settled",
] as const;
export type TravelRuleStatus = (typeof TRAVEL_RULE_STATUSES)[number];

/** Allowed status transitions (docs/PLAN.md §7). */
export const TRAVEL_RULE_TRANSITIONS: Record<TravelRuleStatus, TravelRuleStatus[]> = {
  draft: ["awaiting_counterparty", "unhosted_verification"],
  awaiting_counterparty: ["acknowledged", "rejected"],
  acknowledged: ["accepted", "rejected"],
  accepted: ["settled"],
  rejected: [],
  unhosted_verification: ["settled", "rejected"],
  settled: [],
};

export function canTransition(from: TravelRuleStatus, to: TravelRuleStatus): boolean {
  return TRAVEL_RULE_TRANSITIONS[from].includes(to);
}
