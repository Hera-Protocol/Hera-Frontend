/**
 * Every HTTP route the API serves, with its auth and schemas. The e2e suite
 * checks this table against the controllers' decorators in both directions,
 * so a route can't be added, removed or re-permissioned without the spec following.
 */
import {
  acceptInviteSchema,
  ALERT_STATUSES,
  type ApiKeyScope,
  createApiKeySchema,
  createInviteSchema,
  createReportSchema,
  createTravelRuleSchema,
  createWalletSchema,
  createWebhookSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type Role,
  screenRequestSchema,
  signupSchema,
  switchOrgSchema,
  transitionTravelRuleSchema,
  updateAlertSchema,
  updateMemberSchema,
  updateOrgSchema,
  updateProfileSchema,
  updateWebhookSchema,
  verifyEmailSchema,
} from "@hera/core";
import type { ZodTypeAny } from "zod";
import * as S from "./schemas";
import { registry } from "./schemas";
import { z } from "./zod";

export type HttpMethod = "get" | "post" | "patch" | "delete";
export type RateGroup = "auth" | "screen" | "verify";

export interface RouteResponse {
  status: number;
  description: string;
  schema?: ZodTypeAny;
  /** Defaults to application/json. */
  contentType?: string;
}

export interface RouteDoc {
  method: HttpMethod;
  /** Express-style, with the /v1 prefix: `/v1/wallets/:id`. */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  /** No credentials needed. */
  public?: boolean;
  /** Minimum role for session callers (default viewer). Ignored when public. */
  minRole?: Role;
  /** API keys with this scope may call the route; without it, keys get 403. */
  apiKey?: ApiKeyScope;
  rateLimit?: RateGroup;
  /** Accepts an `Idempotency-Key` header. */
  idempotent?: boolean;
  body?: ZodTypeAny;
  query?: z.AnyZodObject;
  responses: RouteResponse[];
}

/* ─── Registered request schemas ─────────────────────── */

const req = {
  signup: registry.register("SignupInput", signupSchema),
  login: registry.register("LoginInput", loginSchema),
  forgotPassword: registry.register("ForgotPasswordInput", forgotPasswordSchema),
  resetPassword: registry.register("ResetPasswordInput", resetPasswordSchema),
  verifyEmail: registry.register("VerifyEmailInput", verifyEmailSchema),
  switchOrg: registry.register("SwitchOrgInput", switchOrgSchema),
  updateProfile: registry.register("UpdateProfileInput", updateProfileSchema),
  notificationPrefs: S.NotificationPrefsSchema,
  updateOrg: registry.register("UpdateOrgInput", updateOrgSchema),
  updateMember: registry.register("UpdateMemberInput", updateMemberSchema),
  createInvite: registry.register("CreateInviteInput", createInviteSchema),
  acceptInvite: registry.register("AcceptInviteInput", acceptInviteSchema),
  screen: registry.register("ScreenRequest", screenRequestSchema),
  createWallet: registry.register("CreateWalletInput", createWalletSchema),
  updateAlert: registry.register("UpdateAlertInput", updateAlertSchema),
  createTravelRule: registry.register("CreateTravelRuleInput", createTravelRuleSchema),
  transitionTravelRule: registry.register("TransitionTravelRuleInput", transitionTravelRuleSchema),
  createApiKey: registry.register("CreateApiKeyInput", createApiKeySchema),
  createWebhook: registry.register("CreateWebhookInput", createWebhookSchema),
  updateWebhook: registry.register("UpdateWebhookInput", updateWebhookSchema),
  createReport: registry.register("CreateReportInput", createReportSchema),
};

const limit = (fallback: number, max: number) =>
  z.object({ limit: z.coerce.number().int().min(1).max(max).default(fallback).optional().openapi({ description: `Default ${fallback}, max ${max}.` }) });

const ok = (status: number, description: string, schema?: ZodTypeAny): RouteResponse => ({ status, description, schema });
const noContent: RouteResponse = { status: 204, description: "Done. No body." };

/* ─── The table ──────────────────────────────────────── */

export const ROUTES: RouteDoc[] = [
  // System
  { method: "get", path: "/v1/health", tag: "System", summary: "Liveness check", public: true, responses: [ok(200, "Healthy", S.HealthResponseSchema)] },
  { method: "get", path: "/v1/chains", tag: "System", summary: "Supported chains", public: true, responses: [ok(200, "Chains", z.array(S.ChainDtoSchema))] },
  { method: "get", path: "/v1/openapi.json", tag: "System", summary: "This OpenAPI 3.1 document", public: true, responses: [ok(200, "The spec", z.record(z.unknown()))] },

  // Auth
  {
    method: "post", path: "/v1/auth/signup", tag: "Auth", summary: "Create an account and org", public: true, rateLimit: "auth",
    description: "Creates the user as owner of a new org, starts a session (Set-Cookie) and emails a verification link.",
    body: req.signup, responses: [ok(201, "Signed in", S.MeResponseSchema)],
  },
  { method: "post", path: "/v1/auth/login", tag: "Auth", summary: "Sign in", public: true, rateLimit: "auth", body: req.login, responses: [ok(200, "Signed in (Set-Cookie)", S.MeResponseSchema)] },
  { method: "post", path: "/v1/auth/logout", tag: "Auth", summary: "Sign out", public: true, responses: [noContent] },
  { method: "get", path: "/v1/auth/me", tag: "Auth", summary: "The signed-in user, org and role", responses: [ok(200, "Me", S.MeResponseSchema)] },
  {
    method: "post", path: "/v1/auth/forgot-password", tag: "Auth", summary: "Email a password reset link", public: true, rateLimit: "auth",
    description: "Always 202, whether or not the email has an account.", body: req.forgotPassword, responses: [ok(202, "Accepted", S.OkResponseSchema)],
  },
  { method: "post", path: "/v1/auth/reset-password", tag: "Auth", summary: "Set a new password from a reset link", public: true, rateLimit: "auth", body: req.resetPassword, responses: [ok(200, "Password changed; every session is revoked", S.OkResponseSchema)] },
  { method: "post", path: "/v1/auth/verify-email", tag: "Auth", summary: "Confirm an email address", public: true, rateLimit: "auth", description: "Links expire after 24 hours.", body: req.verifyEmail, responses: [ok(200, "Verified", S.OkResponseSchema)] },
  { method: "post", path: "/v1/auth/resend-verification", tag: "Auth", summary: "Email a new verification link", rateLimit: "auth", responses: [ok(202, "Accepted", S.OkResponseSchema)] },
  { method: "post", path: "/v1/auth/switch-org", tag: "Auth", summary: "Point the session at another org you belong to", body: req.switchOrg, responses: [ok(200, "Switched", S.MeResponseSchema)] },
  { method: "patch", path: "/v1/me", tag: "Auth", summary: "Update your profile", body: req.updateProfile, responses: [ok(200, "Updated", S.MeResponseSchema)] },
  { method: "get", path: "/v1/me/orgs", tag: "Auth", summary: "Every org you belong to", responses: [ok(200, "Memberships", z.array(S.MembershipDtoSchema))] },
  { method: "patch", path: "/v1/me/notifications", tag: "Auth", summary: "Email notification preferences", description: "`alertEmails: false` stops high and critical alert emails.", body: req.notificationPrefs, responses: [ok(200, "Updated", S.NotificationPrefsSchema)] },

  // Org and team
  { method: "get", path: "/v1/org", tag: "Team", summary: "Org details and members", responses: [ok(200, "Org", S.OrgDetailResponseSchema)] },
  { method: "patch", path: "/v1/org", tag: "Team", summary: "Rename the org", minRole: "admin", body: req.updateOrg, responses: [ok(200, "Updated", S.OrgDetailResponseSchema)] },
  {
    method: "patch", path: "/v1/org/members/:userId", tag: "Team", summary: "Change a member's role", minRole: "admin",
    description: "Owners can set any role. Admins can't change owners or grant owner. The last owner can't be demoted (409 last_owner).",
    body: req.updateMember, responses: [ok(200, "Updated", S.MemberDtoSchema)],
  },
  {
    method: "delete", path: "/v1/org/members/:userId", tag: "Team", summary: "Remove a member, or leave",
    description: "Removing someone else needs admin (and owner to remove an owner). Anyone can remove themselves, except the last owner. The member's sessions for this org are revoked.",
    responses: [noContent],
  },
  { method: "get", path: "/v1/invites", tag: "Team", summary: "List invites", minRole: "admin", responses: [ok(200, "Invites", z.array(S.InviteDtoSchema))] },
  {
    method: "post", path: "/v1/invites", tag: "Team", summary: "Invite someone by email", minRole: "admin",
    description: "Invites expire after 7 days. 409 already_member or invite_pending.", body: req.createInvite, responses: [ok(201, "Invited", S.InviteDtoSchema)],
  },
  { method: "delete", path: "/v1/invites/:id", tag: "Team", summary: "Revoke an invite", minRole: "admin", responses: [noContent] },
  { method: "post", path: "/v1/invites/:id/resend", tag: "Team", summary: "Send a fresh invite link", minRole: "admin", description: "Issues a new token and resets the 7 day expiry. The old link stops working.", responses: [ok(200, "Resent", S.InviteDtoSchema)] },
  {
    method: "get", path: "/v1/invites/lookup", tag: "Team", summary: "Describe an invite from its token", public: true, rateLimit: "auth",
    query: z.object({ token: z.string().min(16) }), responses: [ok(200, "Invite", S.InviteLookupResponseSchema)],
  },
  {
    method: "post", path: "/v1/invites/accept", tag: "Team", summary: "Accept an invite", public: true, rateLimit: "auth",
    description: "New users send `name` and a new `password`; existing users send their current password. Starts a session in the inviting org. 410 invite_expired for expired or revoked invites.",
    body: req.acceptInvite, responses: [ok(200, "Signed in (Set-Cookie)", S.MeResponseSchema)],
  },

  // Screening
  {
    method: "post", path: "/v1/screen", tag: "Screening", summary: "Screen an address", minRole: "analyst", apiKey: "screen", rateLimit: "screen",
    idempotent: true,
    description: "Live chain data, scored with reasons. Emits `screening.completed`. A chain the registry knows but hasn't switched on is 422 `chain_not_live` (with `fields.chain`); 502 `chain_unavailable` means the upstream data source failed.",
    body: req.screen, responses: [ok(200, "Result", S.ScreeningResponseSchema)],
  },
  { method: "get", path: "/v1/screenings", tag: "Screening", summary: "Screening history", apiKey: "read", query: limit(50, 200), responses: [ok(200, "Page", S.PaginatedScreeningsSchema)] },
  { method: "get", path: "/v1/screenings/:id", tag: "Screening", summary: "One screening, in full", apiKey: "read", responses: [ok(200, "Result", S.ScreeningResponseSchema)] },

  // Wallets
  { method: "get", path: "/v1/wallets", tag: "Wallets", summary: "Watched wallets", apiKey: "read", responses: [ok(200, "Wallets", z.array(S.WalletDtoSchema))] },
  { method: "post", path: "/v1/wallets", tag: "Wallets", summary: "Watch a wallet", minRole: "analyst", apiKey: "monitor", description: "Screens immediately. 409 wallet_exists; 422 chain_not_live.", body: req.createWallet, responses: [ok(201, "Watching", S.WalletDtoSchema)] },
  { method: "delete", path: "/v1/wallets/:id", tag: "Wallets", summary: "Stop watching", minRole: "analyst", apiKey: "monitor", responses: [noContent] },
  { method: "post", path: "/v1/wallets/:id/refresh", tag: "Wallets", summary: "Rescreen now", minRole: "analyst", apiKey: "monitor", responses: [ok(200, "Rescreened", S.WalletDtoSchema)] },

  // Alerts
  { method: "get", path: "/v1/alerts", tag: "Alerts", summary: "Alerts", apiKey: "read", query: z.object({ status: z.enum(ALERT_STATUSES).optional() }), responses: [ok(200, "Alerts", z.array(S.AlertDtoSchema))] },
  { method: "get", path: "/v1/alerts/:id", tag: "Alerts", summary: "One alert", apiKey: "read", responses: [ok(200, "Alert", S.AlertDtoSchema)] },
  { method: "patch", path: "/v1/alerts/:id", tag: "Alerts", summary: "Review, escalate or close an alert", minRole: "analyst", apiKey: "monitor", description: "Emits `alert.updated`.", body: req.updateAlert, responses: [ok(200, "Updated", S.AlertDtoSchema)] },

  // Travel Rule
  { method: "get", path: "/v1/travel-rule/transfers", tag: "Travel Rule", summary: "Transfers", apiKey: "travel_rule", responses: [ok(200, "Transfers", z.array(S.TravelRuleTransferDtoSchema))] },
  { method: "get", path: "/v1/travel-rule/transfers/:id", tag: "Travel Rule", summary: "One transfer", apiKey: "travel_rule", responses: [ok(200, "Transfer", S.TravelRuleTransferDtoSchema)] },
  { method: "post", path: "/v1/travel-rule/transfers", tag: "Travel Rule", summary: "Create a transfer record", minRole: "analyst", apiKey: "travel_rule", idempotent: true, body: req.createTravelRule, responses: [ok(201, "Created", S.TravelRuleTransferDtoSchema)] },
  {
    method: "post", path: "/v1/travel-rule/transfers/:id/transition", tag: "Travel Rule", summary: "Move a transfer to its next status", minRole: "analyst", apiKey: "travel_rule",
    description: "409 invalid_transition for moves the status machine doesn't allow.", body: req.transitionTravelRule, responses: [ok(200, "Moved", S.TravelRuleTransferDtoSchema)],
  },

  // API keys
  { method: "get", path: "/v1/keys", tag: "API keys", summary: "API keys", responses: [ok(200, "Keys", z.array(S.ApiKeyDtoSchema))] },
  { method: "post", path: "/v1/keys", tag: "API keys", summary: "Create an API key", minRole: "admin", body: req.createApiKey, responses: [ok(201, "Created; the secret is shown once", S.CreateApiKeyResponseSchema)] },
  { method: "delete", path: "/v1/keys/:id", tag: "API keys", summary: "Revoke an API key", minRole: "admin", responses: [noContent] },

  // Audit and overview
  { method: "get", path: "/v1/audit", tag: "Audit", summary: "Audit log, newest first", query: limit(100, 500), responses: [ok(200, "Events", z.array(S.AuditEventDtoSchema))] },
  { method: "get", path: "/v1/audit/verify", tag: "Audit", summary: "Recompute the hash chain", responses: [ok(200, "Result", S.AuditVerifyResponseSchema)] },
  { method: "get", path: "/v1/overview", tag: "Overview", summary: "Dashboard aggregates", apiKey: "read", responses: [ok(200, "Overview", S.OverviewResponseSchema)] },

  // Webhooks
  { method: "get", path: "/v1/webhooks", tag: "Webhooks", summary: "Webhook endpoints", minRole: "analyst", responses: [ok(200, "Endpoints", z.array(S.WebhookEndpointDtoSchema))] },
  { method: "post", path: "/v1/webhooks", tag: "Webhooks", summary: "Add an endpoint", minRole: "admin", body: req.createWebhook, responses: [ok(201, "Created; the signing secret is shown once", S.CreateWebhookResponseSchema)] },
  { method: "patch", path: "/v1/webhooks/:id", tag: "Webhooks", summary: "Change an endpoint", minRole: "admin", description: "Re-enabling an endpoint resets its failure count.", body: req.updateWebhook, responses: [ok(200, "Updated", S.WebhookEndpointDtoSchema)] },
  { method: "delete", path: "/v1/webhooks/:id", tag: "Webhooks", summary: "Delete an endpoint", minRole: "admin", responses: [noContent] },
  { method: "post", path: "/v1/webhooks/:id/rotate-secret", tag: "Webhooks", summary: "Issue a new signing secret", minRole: "admin", description: "The old secret stops working immediately.", responses: [ok(200, "Rotated; the new secret is shown once", S.CreateWebhookResponseSchema)] },
  { method: "post", path: "/v1/webhooks/:id/test", tag: "Webhooks", summary: "Send a test event", minRole: "admin", description: "Queues the endpoint's first subscribed event type with `data: { test: true }`.", responses: [ok(202, "Queued", S.WebhookDeliveryDtoSchema)] },
  { method: "get", path: "/v1/webhooks/:id/deliveries", tag: "Webhooks", summary: "Recent deliveries to an endpoint", minRole: "analyst", query: limit(50, 200), responses: [ok(200, "Deliveries", z.array(S.WebhookDeliveryDtoSchema))] },
  { method: "post", path: "/v1/webhooks/deliveries/:id/redeliver", tag: "Webhooks", summary: "Send a delivery's event again", minRole: "admin", description: "Queues a new delivery of the same, byte-identical event.", responses: [ok(202, "Queued", S.WebhookDeliveryDtoSchema)] },

  // Reports
  {
    method: "post", path: "/v1/reports", tag: "Reports", summary: "Generate a compliance report", minRole: "analyst", apiKey: "read",
    description:
      "`screening_evidence` and `travel_rule` render synchronously (201, status ready). `audit` is queued (202) and renders in the background; poll `GET /v1/reports/{id}` or subscribe to `report.ready`. API keys: `travel_rule` reports also need the travel_rule scope, and `audit` reports need a dashboard session.",
    body: req.createReport,
    responses: [ok(201, "Rendered", S.ReportDtoSchema), ok(202, "Queued", S.ReportDtoSchema)],
  },
  { method: "get", path: "/v1/reports", tag: "Reports", summary: "Reports, newest first", apiKey: "read", responses: [ok(200, "Reports", z.array(S.ReportDtoSchema))] },
  {
    method: "get", path: "/v1/reports/verify", tag: "Reports", summary: "Check a report's SHA-256", public: true, rateLimit: "verify",
    description: "Matches the hash of either the PDF or the JSON snapshot. Never returns contents. 30 requests a minute per IP.",
    query: z.object({ sha256: z.string().openapi({ description: "64 hex characters" }) }), responses: [ok(200, "Result", S.ReportVerifyResponseSchema)],
  },
  { method: "get", path: "/v1/reports/:id", tag: "Reports", summary: "Report metadata and hashes", apiKey: "read", responses: [ok(200, "Report", S.ReportDtoSchema)] },
  { method: "get", path: "/v1/reports/:id/pdf", tag: "Reports", summary: "Download the PDF", apiKey: "read", responses: [{ status: 200, description: "`<reference>.pdf` as an attachment", contentType: "application/pdf", schema: z.string().openapi({ format: "binary" }) }] },
  { method: "get", path: "/v1/reports/:id/json", tag: "Reports", summary: "Download the frozen JSON snapshot", apiKey: "read", description: "The exact canonical bytes whose SHA-256 is `jsonSha256`.", responses: [ok(200, "Snapshot", z.record(z.unknown()))] },
];

/** Webhook payloads, as OpenAPI 3.1 `webhooks`. */
export const WEBHOOK_PAYLOADS: { type: string; summary: string; data: ZodTypeAny }[] = [
  { type: "screening.completed", summary: "A screening finished (POST /v1/screen)", data: S.ScreeningSummaryDtoSchema },
  { type: "alert.created", summary: "A watched wallet raised a new alert", data: S.AlertDtoSchema },
  { type: "alert.updated", summary: "An alert's status, disposition or notes changed", data: S.AlertDtoSchema },
  { type: "wallet.activity", summary: "A watched wallet has newer on-chain activity", data: S.WalletActivityDataSchema },
  { type: "travel_rule.updated", summary: "A Travel Rule transfer was created or changed status", data: S.TravelRuleTransferDtoSchema },
  { type: "report.ready", summary: "A report finished rendering", data: S.ReportDtoSchema },
];
