import type {
  AlertDto,
  AlertStatus,
  ApiKeyScope,
  ChainId,
  Decision,
  Disposition,
  IvmsPerson,
  Plan,
  ReasonCode,
  ReportStatus,
  ReportType,
  RiskBand,
  Role,
  ScreeningResult,
  SubjectRef,
  TravelRuleCheck,
  TravelRuleStatus,
  WebhookDeliveryStatus,
  WebhookEventType,
} from "@hera/core";
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const orgRef = () => uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" });

/* ─── Identity ───────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    /** Opt-out for high and critical alert notifications. */
    alertEmails: boolean("alert_emails").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const orgs = pgTable("orgs", {
  id: id(),
  name: text("name").notNull(),
  plan: text("plan").$type<Plan>().notNull(),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: orgRef(),
    role: text("role").$type<Role>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_user_org_key").on(t.userId, t.orgId), index("memberships_org_idx").on(t.orgId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: orgRef(),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_hash_key").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("password_resets_token_hash_key").on(t.tokenHash)],
);

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("email_verifications_token_hash_key").on(t.tokenHash), index("email_verifications_user_idx").on(t.userId)],
);

export const invites = pgTable(
  "invites",
  {
    id: id(),
    orgId: orgRef(),
    email: text("email").notNull(),
    role: text("role").$type<Role>().notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    /** Display name at invite time, so the invite still reads well if the inviter leaves. */
    invitedByName: text("invited_by_name").notNull(),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invites_token_hash_key").on(t.tokenHash), index("invites_org_email_idx").on(t.orgId, t.email)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    orgId: orgRef(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    secretHash: text("secret_hash").notNull(),
    scopes: text("scopes").array().$type<ApiKeyScope[]>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("api_keys_prefix_key").on(t.prefix), index("api_keys_org_idx").on(t.orgId)],
);

/* ─── Screening and monitoring ───────────────────────── */

export const screenings = pgTable(
  "screenings",
  {
    id: id(),
    orgId: orgRef(),
    subjectKey: text("subject_key").notNull(),
    chain: text("chain").$type<ChainId>().notNull(),
    display: text("display").notNull(),
    subject: jsonb("subject").$type<SubjectRef>().notNull(),
    score: integer("score").notNull(),
    band: text("band").$type<RiskBand>().notNull(),
    decision: text("decision").$type<Decision>().notNull(),
    result: jsonb("result").$type<ScreeningResult>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("screenings_org_created_idx").on(t.orgId, t.createdAt), index("screenings_org_subject_idx").on(t.orgId, t.subjectKey)],
);

export const wallets = pgTable(
  "wallets",
  {
    id: id(),
    orgId: orgRef(),
    subjectKey: text("subject_key").notNull(),
    chain: text("chain").$type<ChainId>().notNull(),
    subject: jsonb("subject").$type<SubjectRef>().notNull(),
    display: text("display").notNull(),
    label: text("label").notNull(),
    customerRef: text("customer_ref"),
    lastScore: integer("last_score"),
    lastBand: text("last_band").$type<RiskBand>(),
    lastCheckedAt: ts("last_checked_at"),
    lastActivityAt: ts("last_activity_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wallets_org_subject_key").on(t.orgId, t.subjectKey), index("wallets_last_checked_idx").on(t.lastCheckedAt)],
);

export type AlertSeverity = AlertDto["severity"];

export const alerts = pgTable(
  "alerts",
  {
    id: id(),
    orgId: orgRef(),
    walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: "set null" }),
    chain: text("chain").$type<ChainId>().notNull(),
    subjectDisplay: text("subject_display").notNull(),
    reasonCode: text("reason_code").$type<ReasonCode>().notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    severity: text("severity").$type<AlertSeverity>().notNull(),
    status: text("status").$type<AlertStatus>().notNull().default("open"),
    disposition: text("disposition").$type<Disposition>(),
    score: integer("score").notNull(),
    txHash: text("tx_hash"),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("alerts_org_dedupe_key").on(t.orgId, t.dedupeKey), index("alerts_org_status_idx").on(t.orgId, t.status)],
);

export const alertNotes = pgTable(
  "alert_notes",
  {
    id: id(),
    orgId: orgRef(),
    alertId: uuid("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    /** Display name at the time, so API-key notes (no user row) still say who wrote them. */
    authorName: text("author_name"),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("alert_notes_alert_idx").on(t.alertId)],
);

/* ─── Travel Rule ────────────────────────────────────── */

export interface VaspRecord {
  name: string;
  lei?: string;
  domain?: string;
}

export const travelRuleTransfers = pgTable(
  "travel_rule_transfers",
  {
    id: id(),
    orgId: orgRef(),
    reference: text("reference").notNull(),
    direction: text("direction").$type<"outgoing" | "incoming">().notNull(),
    chain: text("chain").$type<ChainId>().notNull(),
    asset: text("asset").notNull(),
    amount: text("amount").notNull(),
    amountUsd: numeric("amount_usd", { precision: 20, scale: 2 }).notNull(),
    txHash: text("tx_hash"),
    jurisdiction: text("jurisdiction").notNull(),
    originator: jsonb("originator").$type<IvmsPerson>().notNull(),
    originatorAccount: jsonb("originator_account").$type<SubjectRef>().notNull(),
    beneficiary: jsonb("beneficiary").$type<IvmsPerson>().notNull(),
    beneficiaryAccount: jsonb("beneficiary_account").$type<SubjectRef>().notNull(),
    beneficiaryVasp: jsonb("beneficiary_vasp").$type<VaspRecord | null>(),
    status: text("status").$type<TravelRuleStatus>().notNull(),
    check: jsonb("check").$type<TravelRuleCheck>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("travel_rule_org_reference_key").on(t.orgId, t.reference), index("travel_rule_org_created_idx").on(t.orgId, t.createdAt)],
);

export const travelRuleEvents = pgTable(
  "travel_rule_events",
  {
    id: id(),
    orgId: orgRef(),
    transferId: uuid("transfer_id").notNull().references(() => travelRuleTransfers.id, { onDelete: "cascade" }),
    status: text("status").$type<TravelRuleStatus>().notNull(),
    note: text("note"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** Display name at the time of the event; API keys have no user row to join. */
    actor: text("actor").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("travel_rule_events_transfer_idx").on(t.transferId, t.at)],
);

/* ─── Audit ──────────────────────────────────────────── */

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    orgId: orgRef(),
    seq: integer("seq").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [uniqueIndex("audit_events_org_seq_key").on(t.orgId, t.seq)],
);

/* ─── Webhooks ───────────────────────────────────────── */

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: id(),
    orgId: orgRef(),
    url: text("url").notNull(),
    events: text("events").array().$type<WebhookEventType[]>().notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    /** AES-256-GCM ciphertext of the `whsec_…` signing secret: `v1.<iv>.<tag>.<ciphertext>`, base64url. */
    secretCiphertext: text("secret_ciphertext").notNull(),
    secretPrefix: text("secret_prefix").notNull(),
    failureCount: integer("failure_count").notNull().default(0),
    lastDeliveryAt: ts("last_delivery_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("webhook_endpoints_org_idx").on(t.orgId)],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    /** `evt_…`, also the envelope id. */
    id: text("id").primaryKey(),
    orgId: orgRef(),
    type: text("type").$type<WebhookEventType>().notNull(),
    /** The exact JSON body that is signed and POSTed, kept verbatim so redeliveries are byte-identical. */
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("webhook_events_org_created_idx").on(t.orgId, t.createdAt)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    orgId: orgRef(),
    endpointId: uuid("endpoint_id").notNull().references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull().references(() => webhookEvents.id, { onDelete: "cascade" }),
    eventType: text("event_type").$type<WebhookEventType>().notNull(),
    status: text("status").$type<WebhookDeliveryStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    responseStatus: integer("response_status"),
    error: text("error"),
    nextAttemptAt: ts("next_attempt_at"),
    lastAttemptAt: ts("last_attempt_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt),
    index("webhook_deliveries_endpoint_idx").on(t.endpointId, t.createdAt),
  ],
);

/* ─── Reports ────────────────────────────────────────── */

export const reports = pgTable(
  "reports",
  {
    id: id(),
    orgId: orgRef(),
    reference: text("reference").notNull(),
    type: text("type").$type<ReportType>().notNull(),
    title: text("title").notNull(),
    status: text("status").$type<ReportStatus>().notNull(),
    params: jsonb("params").$type<Record<string, unknown>>().notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    jsonSha256: text("json_sha256"),
    pdfSha256: text("pdf_sha256"),
    /** Key in report storage; `<key>.pdf` and `<key>.json` sit side by side. */
    storageKey: text("storage_key"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    requestedByName: text("requested_by_name").notNull(),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    error: text("error"),
    createdAt: createdAt(),
    readyAt: ts("ready_at"),
  },
  (t) => [
    uniqueIndex("reports_reference_key").on(t.reference),
    index("reports_org_created_idx").on(t.orgId, t.createdAt),
    index("reports_json_sha256_idx").on(t.jsonSha256),
    index("reports_pdf_sha256_idx").on(t.pdfSha256),
    index("reports_status_idx").on(t.status),
  ],
);

/* ─── Idempotency ────────────────────────────────────── */

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: id(),
    orgId: orgRef(),
    key: text("key").notNull(),
    /** `POST /v1/screen`: a key is scoped to one route. */
    route: text("route").notNull(),
    /** SHA-256 of the canonical request body; a reused key with a different body is refused. */
    requestHash: text("request_hash").notNull(),
    /** Null while the first request is still running. */
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [uniqueIndex("idempotency_keys_org_route_key").on(t.orgId, t.route, t.key), index("idempotency_keys_expires_idx").on(t.expiresAt)],
);
