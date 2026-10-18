/**
 * The Hera REST contract (`/v1`). Request schemas validate in both the browser
 * and the API; response DTOs type both sides. Change this file first, then the
 * implementations.
 */
import { z } from "zod";
import { ivmsPersonSchema, type IvmsPerson, type TravelRuleCheck, type TravelRuleStatus, vaspSchema } from "./travel-rule";
import type { ChainId, Decision, ReasonCode, RiskBand, ScreeningResult, SubjectRef } from "./types";

/* ─── Shared ─────────────────────────────────────────── */

export const chainIdSchema = z.string().regex(/^(stellar|evm:\d+)$/, "Unknown chain") as z.ZodType<ChainId>;

export const memoSchema = z.object({
  type: z.enum(["id", "text", "hash"]),
  value: z.string().trim().max(64),
});

export const subjectInputSchema = z.object({
  address: z.string().trim().min(1, "Enter an address").max(128),
  chain: chainIdSchema.optional(),
  memo: memoSchema.optional(),
});
export type SubjectInput = z.infer<typeof subjectInputSchema>;

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export interface Paginated<T> {
  items: T[];
  total: number;
}

/* ─── Auth ───────────────────────────────────────────── */

export const PLANS = ["developer", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];
export const ROLES = ["owner", "admin", "analyst", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "That's too long")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Mix letters and numbers");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid work email").max(254),
  company: z.string().trim().min(2, "Company name is required").max(120),
  password: passwordSchema,
  plan: z.enum(PLANS).default("developer"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") });

export const resetPasswordSchema = z.object({ token: z.string().min(16).max(256), password: passwordSchema });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(16).max(256) });

/** Body of 202/200 acknowledgements that carry no resource. */
export interface OkResponse {
  ok: true;
}

export const updateProfileSchema = z.object({ name: z.string().trim().min(2).max(80) });
export const updateOrgSchema = z.object({ name: z.string().trim().min(2).max(120) });

export interface UserDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface OrgDto {
  id: string;
  name: string;
  plan: Plan;
  createdAt: string;
}

export interface MeResponse {
  user: UserDto;
  org: OrgDto;
  role: Role;
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export interface OrgDetailResponse extends OrgDto {
  members: MemberDto[];
}

/* ─── Chains ─────────────────────────────────────────── */

export interface ChainDto {
  id: ChainId;
  name: string;
  family: "stellar" | "evm";
  nativeSymbol: string;
  live: boolean;
}

/* ─── Screening ──────────────────────────────────────── */

export const screenRequestSchema = subjectInputSchema;
export type ScreenRequest = SubjectInput;

export interface ScreeningResponse extends ScreeningResult {
  id: string;
}

export interface ScreeningSummaryDto {
  id: string;
  chain: ChainId;
  display: string;
  score: number;
  band: RiskBand;
  decision: Decision;
  topReason?: string;
  createdAt: string;
}

/* ─── Wallets (monitoring) ───────────────────────────── */

export const createWalletSchema = subjectInputSchema.extend({
  label: z.string().trim().min(1, "Give it a label").max(80),
  customerRef: z.string().trim().max(120).optional(),
});
export type CreateWalletInput = z.infer<typeof createWalletSchema>;

export interface WalletDto {
  id: string;
  chain: ChainId;
  subject: SubjectRef;
  display: string;
  label: string;
  customerRef?: string;
  lastScore?: number;
  lastBand?: RiskBand;
  lastCheckedAt?: string;
  lastActivityAt?: string;
  createdAt: string;
}

/* ─── Alerts ─────────────────────────────────────────── */

export const ALERT_STATUSES = ["open", "in_review", "escalated", "closed"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];
export const DISPOSITIONS = ["true_positive", "false_positive"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export const updateAlertSchema = z
  .object({
    status: z.enum(ALERT_STATUSES).optional(),
    disposition: z.enum(DISPOSITIONS).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status !== "closed" || (v.disposition && v.note), {
    message: "Closing an alert needs a disposition and a note",
    path: ["note"],
  });
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;

export interface AlertNoteDto {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface AlertDto {
  id: string;
  walletId?: string;
  walletLabel?: string;
  chain: ChainId;
  subjectDisplay: string;
  reasonCode: ReasonCode;
  title: string;
  detail: string;
  severity: "low" | "medium" | "high" | "critical";
  status: AlertStatus;
  disposition?: Disposition;
  score: number;
  txHash?: string;
  notes: AlertNoteDto[];
  createdAt: string;
  updatedAt: string;
}

/* ─── Travel Rule ────────────────────────────────────── */

export const createTravelRuleSchema = z.object({
  direction: z.enum(["outgoing", "incoming"]),
  chain: chainIdSchema,
  asset: z.string().trim().min(1).max(12),
  amount: z.string().trim().regex(/^\d+(\.\d+)?$/, "Enter an amount"),
  amountUsd: z.coerce.number().nonnegative(),
  txHash: z.string().trim().max(100).optional(),
  jurisdiction: z.string().min(2).max(8),
  originator: ivmsPersonSchema,
  originatorAccount: subjectInputSchema,
  beneficiary: ivmsPersonSchema,
  beneficiaryAccount: subjectInputSchema,
  /** null = self-hosted (unhosted) wallet. */
  beneficiaryVasp: vaspSchema.nullable(),
});
export type CreateTravelRuleInput = z.infer<typeof createTravelRuleSchema>;

export const transitionTravelRuleSchema = z.object({
  to: z.enum(["draft", "awaiting_counterparty", "acknowledged", "accepted", "rejected", "unhosted_verification", "settled"]),
  note: z.string().trim().max(1000).optional(),
});

export interface TravelRuleEventDto {
  status: TravelRuleStatus;
  note?: string;
  actor: string;
  at: string;
}

export interface TravelRuleTransferDto {
  id: string;
  reference: string;
  direction: "outgoing" | "incoming";
  chain: ChainId;
  asset: string;
  amount: string;
  amountUsd: number;
  txHash?: string;
  jurisdiction: string;
  originator: IvmsPerson;
  originatorAccount: SubjectRef;
  beneficiary: IvmsPerson;
  beneficiaryAccount: SubjectRef;
  beneficiaryVasp: { name: string; lei?: string; domain?: string } | null;
  status: TravelRuleStatus;
  check: TravelRuleCheck;
  events: TravelRuleEventDto[];
  createdAt: string;
  updatedAt: string;
}

/* ─── API keys ───────────────────────────────────────── */

/** `monitor`: manage watched wallets and update alerts, so exchanges can automate their watchlists. */
export const API_KEY_SCOPES = ["read", "screen", "monitor", "travel_rule"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2, "Name it so you know where it's used").max(60),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, "Pick at least one scope"),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export interface ApiKeyDto {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface CreateApiKeyResponse {
  key: ApiKeyDto;
  /** Shown exactly once. */
  secret: string;
}

/* ─── Audit ──────────────────────────────────────────── */

export interface AuditEventDto {
  id: string;
  seq: number;
  actor: string;
  action: string;
  target?: string;
  metadata: Record<string, unknown>;
  hash: string;
  prevHash: string;
  createdAt: string;
}

export interface AuditVerifyResponse {
  valid: boolean;
  checked: number;
  brokenAt?: number;
}

/* ─── Overview ───────────────────────────────────────── */

export interface OverviewResponse {
  screenings24h: number;
  screeningsTotal: number;
  openAlerts: number;
  watchedWallets: number;
  travelRuleOpen: number;
  bandMix: Record<RiskBand, number>;
  daily: { date: string; screenings: number; flagged: number }[];
  recentScreenings: ScreeningSummaryDto[];
  recentAlerts: AlertDto[];
}

/* ─── Team: invites and members ──────────────────────── */

/** Owners are created at signup or by transfer, never by invite. */
export const INVITABLE_ROLES = ["admin", "analyst", "viewer"] as const;

export const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  role: z.enum(INVITABLE_ROLES),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export interface InviteDto {
  id: string;
  email: string;
  role: Role;
  invitedBy: string;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

/** Public lookup so the accept page can greet the invitee before they sign in. */
export interface InviteLookupResponse {
  email: string;
  orgName: string;
  role: Role;
  invitedBy: string;
  existingUser: boolean;
  expired: boolean;
}

/**
 * New users send name + password. Existing users send their current password,
 * which proves they own the account before the membership is added.
 */
export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(256),
  name: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(1).max(128),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const updateMemberSchema = z.object({ role: z.enum(ROLES) });

/** A user can belong to several orgs (via invites); the session points at one. */
export interface MembershipDto {
  orgId: string;
  orgName: string;
  plan: Plan;
  role: Role;
}

export const switchOrgSchema = z.object({ orgId: z.string().uuid() });

/* ─── Webhooks ───────────────────────────────────────── */

export const WEBHOOK_EVENTS = [
  "screening.completed",
  "alert.created",
  "alert.updated",
  "wallet.activity",
  "travel_rule.updated",
  "report.ready",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

const webhookUrlSchema = z
  .string()
  .trim()
  .url("Enter a full URL")
  .max(2048)
  .refine((v) => /^https:\/\//.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(v), "Use https (http is allowed for localhost only)");

export const createWebhookSchema = z.object({
  url: webhookUrlSchema,
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Pick at least one event"),
  description: z.string().trim().max(200).optional(),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  url: webhookUrlSchema.optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  description: z.string().trim().max(200).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

export interface WebhookEndpointDto {
  id: string;
  url: string;
  events: WebhookEventType[];
  description?: string;
  enabled: boolean;
  /** First characters of the signing secret, for recognition only. */
  secretPrefix: string;
  /** Consecutive failed deliveries; endpoints auto-disable at 20. */
  failureCount: number;
  lastDeliveryAt?: string;
  createdAt: string;
}

export interface CreateWebhookResponse {
  endpoint: WebhookEndpointDto;
  /** `whsec_…`, shown exactly once. */
  secret: string;
}

/** The JSON body POSTed to a webhook endpoint. */
export interface WebhookEvent<T = unknown> {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  orgId: string;
  data: T;
}

export const WEBHOOK_DELIVERY_STATUSES = ["pending", "succeeded", "failed"] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export interface WebhookDeliveryDto {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: WebhookEventType;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatus?: number;
  error?: string;
  nextAttemptAt?: string;
  lastAttemptAt?: string;
  createdAt: string;
}

/* ─── Reports (compliance PDFs) ──────────────────────── */

export const REPORT_TYPES = ["screening_evidence", "travel_rule", "audit"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const createReportSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("screening_evidence"), screeningId: z.string().uuid() }),
    z.object({ type: z.literal("travel_rule"), transferId: z.string().uuid() }),
    z.object({ type: z.literal("audit"), from: z.string().date(), to: z.string().date() }),
  ])
  .superRefine((v, ctx) => {
    if (v.type === "audit" && v.from > v.to) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start must be before end", path: ["to"] });
    }
  });
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const REPORT_STATUSES = ["queued", "rendering", "ready", "failed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReportDto {
  id: string;
  /** Human reference printed on every page, e.g. RPT-2026Q3-7KX2. */
  reference: string;
  type: ReportType;
  title: string;
  status: ReportStatus;
  /** SHA-256 of the canonical JSON snapshot the PDF was rendered from. */
  jsonSha256?: string;
  pdfSha256?: string;
  requestedBy: string;
  error?: string;
  createdAt: string;
  readyAt?: string;
}

/** Public: proves a PDF or JSON snapshot is genuine without revealing its contents. */
export interface ReportVerifyResponse {
  valid: boolean;
  reference?: string;
  type?: ReportType;
  orgName?: string;
  createdAt?: string;
  /** Which artifact the hash matched. */
  matched?: "pdf" | "json";
}
