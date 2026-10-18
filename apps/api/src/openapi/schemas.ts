/**
 * Documentation-only zod schemas for the response DTOs, which @hera/core
 * declares as TypeScript interfaces. `schemas.types.test.ts` proves each
 * `z.infer` equals its core type, so the published spec can't drift.
 */
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  ALERT_STATUSES,
  API_KEY_SCOPES,
  chainIdSchema,
  DISPOSITIONS,
  type EvmAddress,
  ivmsPersonSchema,
  LABEL_CATEGORIES,
  PLANS,
  REASON_CODES,
  REPORT_STATUSES,
  REPORT_TYPES,
  ROLES,
  TRANSFER_KINDS,
  TRAVEL_RULE_STATUSES,
  WEBHOOK_DELIVERY_STATUSES,
  WEBHOOK_EVENTS,
} from "@hera/core";
import { z } from "./zod";

export const registry = new OpenAPIRegistry();

const isoDate = () => z.string().datetime({ offset: true }).openapi({ format: "date-time", example: "2026-10-18T12:00:00.000Z" });
const uuid = () => z.string().uuid();

/* ─── Shared ─────────────────────────────────────────── */

export const ApiErrorBodySchema = registry.register(
  "ApiErrorBody",
  z
    .object({
      error: z.object({
        code: z.string().openapi({ example: "validation_failed" }),
        message: z.string(),
        fields: z.record(z.string()).optional().openapi({ description: "Field path → first message, on 422 validation_failed." }),
      }),
    })
    .openapi({ description: "Every error, whatever the status, has this shape." }),
);

export const OkResponseSchema = registry.register("OkResponse", z.object({ ok: z.literal(true) }));

export const ChainIdSchema = registry.register("ChainId", chainIdSchema.openapi({ example: "evm:1", pattern: "^(stellar|evm:\\d+)$" }));
const evmChainSchema = z.string().regex(/^evm:\d+$/) as unknown as z.ZodType<`evm:${number}`>;
const evmAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/) as unknown as z.ZodType<EvmAddress>;

const riskBand = z.enum(["low", "medium", "high", "severe"]);
const decision = z.enum(["allow", "review", "block"]);

export const SubjectRefSchema = registry.register(
  "SubjectRef",
  z.union([
    z.object({
      chain: z.literal("stellar"),
      account: z.string().openapi({ description: "Base G… account." }),
      sub: z
        .union([
          z.object({ kind: z.literal("muxed"), id: z.string().openapi({ description: "uint64 as a decimal string" }), muxed: z.string() }),
          z.object({ kind: z.literal("memo"), type: z.enum(["id", "text", "hash"]), value: z.string() }),
        ])
        .optional(),
    }),
    z.object({ chain: evmChainSchema.openapi({ pattern: "^evm:\\d+$" }), address: evmAddressSchema.openapi({ pattern: "^0x[0-9a-fA-F]{40}$" }) }),
  ]),
);

/* ─── Auth and org ───────────────────────────────────── */

const roleSchema = z.enum(ROLES);
const planSchema = z.enum(PLANS);

export const UserDtoSchema = registry.register(
  "UserDto",
  z.object({ id: uuid(), name: z.string(), email: z.string().email(), emailVerified: z.boolean(), createdAt: isoDate() }),
);
export const OrgDtoSchema = registry.register("OrgDto", z.object({ id: uuid(), name: z.string(), plan: planSchema, createdAt: isoDate() }));
export const MeResponseSchema = registry.register("MeResponse", z.object({ user: UserDtoSchema, org: OrgDtoSchema, role: roleSchema }));
export const MemberDtoSchema = registry.register(
  "MemberDto",
  z.object({ userId: uuid(), name: z.string(), email: z.string(), role: roleSchema, joinedAt: isoDate() }),
);
export const OrgDetailResponseSchema = registry.register(
  "OrgDetailResponse",
  z.object({ id: uuid(), name: z.string(), plan: planSchema, createdAt: isoDate(), members: z.array(MemberDtoSchema) }),
);
export const MembershipDtoSchema = registry.register(
  "MembershipDto",
  z.object({ orgId: uuid(), orgName: z.string(), plan: planSchema, role: roleSchema }),
);
export const InviteDtoSchema = registry.register(
  "InviteDto",
  z.object({
    id: uuid(),
    email: z.string(),
    role: roleSchema,
    invitedBy: z.string(),
    expiresAt: isoDate(),
    acceptedAt: isoDate().optional(),
    revokedAt: isoDate().optional(),
    createdAt: isoDate(),
  }),
);
export const InviteLookupResponseSchema = registry.register(
  "InviteLookupResponse",
  z.object({ email: z.string(), orgName: z.string(), role: roleSchema, invitedBy: z.string(), existingUser: z.boolean(), expired: z.boolean() }),
);

/* ─── Chains ─────────────────────────────────────────── */

export const ChainDtoSchema = registry.register(
  "ChainDto",
  z.object({ id: chainIdSchema, name: z.string(), family: z.enum(["stellar", "evm"]), nativeSymbol: z.string(), live: z.boolean() }),
);

/* ─── Screening ──────────────────────────────────────── */

const labelCategory = z.enum(LABEL_CATEGORIES);

// Derived from core so the docs can never drift from the engine.
export { REASON_CODES };
const reasonCode = z.enum(REASON_CODES);

export const LabelSchema = registry.register(
  "Label",
  z.object({
    chain: chainIdSchema,
    address: z.string(),
    category: labelCategory,
    entity: z.string(),
    source: z.string().openapi({ description: "Provenance. Every label must be explainable." }),
    sourceUrl: z.string().optional(),
    confidence: z.number().min(0).max(1),
    addedAt: z.string(),
    note: z.string().optional(),
  }),
);

export const ReasonSchema = registry.register(
  "Reason",
  z.object({
    code: reasonCode,
    points: z.number(),
    severity: z.enum(["info", "low", "medium", "high", "critical"]),
    title: z.string(),
    detail: z.string(),
    evidence: z.object({ label: LabelSchema.optional(), txHashes: z.array(z.string()).optional(), counterparty: z.string().optional() }).optional(),
  }),
);

const partySchema = z.object({ address: z.string(), muxedId: z.string().optional() });
const assetSchema = z.object({ code: z.string(), issuer: z.string().optional(), decimals: z.number().int() });

export const TransferSchema = registry.register(
  "Transfer",
  z.object({
    id: z.string(),
    chain: chainIdSchema,
    txHash: z.string(),
    timestamp: z.string(),
    kind: z.enum(TRANSFER_KINDS),
    from: partySchema,
    to: partySchema,
    asset: assetSchema,
    amount: z.string().openapi({ description: "Decimal string, never a float." }),
    memo: z.object({ type: z.string(), value: z.string() }).optional(),
    successful: z.boolean(),
    sourceAsset: assetSchema.optional().openapi({ description: "Path payments: what the sender actually spent." }),
    sourceAmount: z.string().optional(),
  }),
);

export const CounterpartySummarySchema = registry.register(
  "CounterpartySummary",
  z.object({ address: z.string(), muxedId: z.string().optional(), inbound: z.number(), outbound: z.number(), labels: z.array(LabelSchema) }),
);

export const SubjectProfileSchema = registry.register(
  "SubjectProfile",
  z.object({
    exists: z.boolean(),
    createdAt: z.string().optional(),
    firstSeen: z.string().optional(),
    observedTransfers: z.number(),
    fullHistory: z.boolean(),
    nativeBalance: z.string().optional(),
    homeDomain: z.string().optional(),
    toml: z
      .object({
        domain: z.string(),
        orgName: z.string().optional(),
        status: z.enum(["verified", "unlisted", "unavailable"]),
        signingKey: z.string().optional(),
        seps: z.array(z.string()),
      })
      .optional(),
    flags: z.object({ authRequired: z.boolean(), authRevocable: z.boolean(), clawbackEnabled: z.boolean() }).optional(),
    sharedAccountRatio: z.number().optional(),
    isContract: z.boolean().optional(),
    delegatedTo: z.string().optional().openapi({ description: "EIP-7702: the contract this EOA delegates its code to." }),
    ensName: z.string().optional(),
    dataStatus: z
      .enum(["complete", "partial", "unavailable"])
      .optional()
      .openapi({ description: "partial/unavailable: some chain sources timed out; the score uses what arrived (labels always apply)." }),
    window: z
      .object({
        pages: z.record(z.number()),
        records: z.number(),
        truncatedBy: z.enum(["page_budget", "deadline", "error"]).optional(),
        missing: z.array(z.string()).optional().openapi({ description: "Sources that didn't answer in time." }),
        claimsResolved: z.number().optional(),
        claimsSkipped: z.number().optional(),
        oldest: z.string().optional(),
      })
      .optional()
      .openapi({ description: "What the adapter actually read." }),
  }),
);

const screeningResultShape = {
  subject: SubjectRefSchema,
  display: z.string(),
  score: z.number().int().min(0).max(100),
  band: riskBand,
  decision,
  reasons: z.array(ReasonSchema),
  profile: SubjectProfileSchema,
  counterparties: z.array(CounterpartySummarySchema),
  transfers: z.array(TransferSchema),
  stats: z.object({
    transfers: z.number(),
    inbound: z.number(),
    outbound: z.number(),
    dustFiltered: z.number(),
    failed: z.number().optional(),
    firstSeen: z.string().optional(),
    lastSeen: z.string().optional(),
  }),
  screenedAt: isoDate(),
  engineVersion: z.string(),
};

export const ScreeningResultSchema = z.object(screeningResultShape);
export const ScreeningResponseSchema = registry.register("ScreeningResponse", z.object({ ...screeningResultShape, id: uuid() }));

export const ScreeningSummaryDtoSchema = registry.register(
  "ScreeningSummaryDto",
  z.object({
    id: uuid(),
    chain: chainIdSchema,
    display: z.string(),
    score: z.number().int(),
    band: riskBand,
    decision,
    topReason: z.string().optional(),
    createdAt: isoDate(),
  }),
);
export const PaginatedScreeningsSchema = registry.register(
  "PaginatedScreeningSummary",
  z.object({ items: z.array(ScreeningSummaryDtoSchema), total: z.number().int() }),
);

/* ─── Wallets and alerts ─────────────────────────────── */

export const WalletDtoSchema = registry.register(
  "WalletDto",
  z.object({
    id: uuid(),
    chain: chainIdSchema,
    subject: SubjectRefSchema,
    display: z.string(),
    label: z.string(),
    customerRef: z.string().optional(),
    lastScore: z.number().int().optional(),
    lastBand: riskBand.optional(),
    lastCheckedAt: isoDate().optional(),
    lastActivityAt: isoDate().optional(),
    createdAt: isoDate(),
  }),
);

export const AlertNoteDtoSchema = registry.register(
  "AlertNoteDto",
  z.object({ id: uuid(), author: z.string(), body: z.string(), createdAt: isoDate() }),
);

export const AlertDtoSchema = registry.register(
  "AlertDto",
  z.object({
    id: uuid(),
    walletId: uuid().optional(),
    walletLabel: z.string().optional(),
    chain: chainIdSchema,
    subjectDisplay: z.string(),
    reasonCode,
    title: z.string(),
    detail: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    status: z.enum(ALERT_STATUSES),
    disposition: z.enum(DISPOSITIONS).optional(),
    score: z.number().int(),
    txHash: z.string().optional(),
    notes: z.array(AlertNoteDtoSchema),
    createdAt: isoDate(),
    updatedAt: isoDate(),
  }),
);

/* ─── Travel Rule ────────────────────────────────────── */

export const IvmsPersonSchema = registry.register("IvmsPerson", ivmsPersonSchema);

export const TravelRuleCheckSchema = registry.register(
  "TravelRuleCheck",
  z.object({ required: z.boolean(), thresholdUsd: z.number(), unhostedProofRequired: z.boolean(), explanation: z.string() }),
);

const travelRuleStatus = z.enum(TRAVEL_RULE_STATUSES);

export const TravelRuleEventDtoSchema = registry.register(
  "TravelRuleEventDto",
  z.object({ status: travelRuleStatus, note: z.string().optional(), actor: z.string(), at: isoDate() }),
);

export const TravelRuleTransferDtoSchema = registry.register(
  "TravelRuleTransferDto",
  z.object({
    id: uuid(),
    reference: z.string().openapi({ example: "TR-7F3K2Q" }),
    direction: z.enum(["outgoing", "incoming"]),
    chain: chainIdSchema,
    asset: z.string(),
    amount: z.string(),
    amountUsd: z.number(),
    txHash: z.string().optional(),
    jurisdiction: z.string(),
    originator: IvmsPersonSchema,
    originatorAccount: SubjectRefSchema,
    beneficiary: IvmsPersonSchema,
    beneficiaryAccount: SubjectRefSchema,
    beneficiaryVasp: z.object({ name: z.string(), lei: z.string().optional(), domain: z.string().optional() }).nullable(),
    status: travelRuleStatus,
    check: TravelRuleCheckSchema,
    events: z.array(TravelRuleEventDtoSchema),
    createdAt: isoDate(),
    updatedAt: isoDate(),
  }),
);

/* ─── API keys and audit ─────────────────────────────── */

export const ApiKeyDtoSchema = registry.register(
  "ApiKeyDto",
  z.object({
    id: uuid(),
    name: z.string(),
    prefix: z.string().openapi({ example: "hera_live_ab12cd34" }),
    scopes: z.array(z.enum(API_KEY_SCOPES)),
    createdAt: isoDate(),
    lastUsedAt: isoDate().optional(),
    revokedAt: isoDate().optional(),
  }),
);
export const CreateApiKeyResponseSchema = registry.register(
  "CreateApiKeyResponse",
  z.object({ key: ApiKeyDtoSchema, secret: z.string().openapi({ description: "Shown exactly once." }) }),
);

export const AuditEventDtoSchema = registry.register(
  "AuditEventDto",
  z.object({
    id: uuid(),
    seq: z.number().int(),
    actor: z.string(),
    action: z.string(),
    target: z.string().optional(),
    metadata: z.record(z.unknown()),
    hash: z.string(),
    prevHash: z.string(),
    createdAt: isoDate(),
  }),
);
export const AuditVerifyResponseSchema = registry.register(
  "AuditVerifyResponse",
  z.object({ valid: z.boolean(), checked: z.number().int(), brokenAt: z.number().int().optional() }),
);

/* ─── Overview ───────────────────────────────────────── */

export const OverviewResponseSchema = registry.register(
  "OverviewResponse",
  z.object({
    screenings24h: z.number().int(),
    screeningsTotal: z.number().int(),
    openAlerts: z.number().int(),
    watchedWallets: z.number().int(),
    travelRuleOpen: z.number().int(),
    bandMix: z.object({ low: z.number(), medium: z.number(), high: z.number(), severe: z.number() }),
    daily: z.array(z.object({ date: z.string(), screenings: z.number(), flagged: z.number() })),
    recentScreenings: z.array(ScreeningSummaryDtoSchema),
    recentAlerts: z.array(AlertDtoSchema),
  }),
);

/* ─── Webhooks ───────────────────────────────────────── */

const webhookEventType = z.enum(WEBHOOK_EVENTS);

export const WebhookEndpointDtoSchema = registry.register(
  "WebhookEndpointDto",
  z.object({
    id: uuid(),
    url: z.string().url(),
    events: z.array(webhookEventType),
    description: z.string().optional(),
    enabled: z.boolean(),
    secretPrefix: z.string().openapi({ example: "whsec_Ab12Cd" }),
    failureCount: z.number().int().openapi({ description: "Consecutive failed delivery attempts; the endpoint auto-disables at 20." }),
    lastDeliveryAt: isoDate().optional(),
    createdAt: isoDate(),
  }),
);
export const CreateWebhookResponseSchema = registry.register(
  "CreateWebhookResponse",
  z.object({ endpoint: WebhookEndpointDtoSchema, secret: z.string().openapi({ description: "`whsec_…`, shown exactly once." }) }),
);
export const WebhookDeliveryDtoSchema = registry.register(
  "WebhookDeliveryDto",
  z.object({
    id: uuid(),
    endpointId: uuid(),
    eventId: z.string().openapi({ example: "evt_3kq9…" }),
    eventType: webhookEventType,
    status: z.enum(WEBHOOK_DELIVERY_STATUSES),
    attempts: z.number().int(),
    responseStatus: z.number().int().optional(),
    error: z.string().optional(),
    nextAttemptAt: isoDate().optional(),
    lastAttemptAt: isoDate().optional(),
    createdAt: isoDate(),
  }),
);

/** The generic envelope; `data` depends on `type`. */
export const WebhookEventSchema = z.object({
  id: z.string(),
  type: webhookEventType,
  createdAt: isoDate(),
  orgId: uuid(),
  data: z.unknown(),
});

export const WalletActivityDataSchema = registry.register(
  "WalletActivityData",
  z.object({ wallet: WalletDtoSchema, newTransfers: z.number().int() }),
);

/* ─── Reports ────────────────────────────────────────── */

export const ReportDtoSchema = registry.register(
  "ReportDto",
  z.object({
    id: uuid(),
    reference: z.string().openapi({ example: "RPT-2026Q3-7KX2" }),
    type: z.enum(REPORT_TYPES),
    title: z.string(),
    status: z.enum(REPORT_STATUSES),
    jsonSha256: z.string().optional(),
    pdfSha256: z.string().optional(),
    requestedBy: z.string(),
    error: z.string().optional(),
    createdAt: isoDate(),
    readyAt: isoDate().optional(),
  }),
);
export const ReportVerifyResponseSchema = registry.register(
  "ReportVerifyResponse",
  z.object({
    valid: z.boolean(),
    reference: z.string().optional(),
    type: z.enum(REPORT_TYPES).optional(),
    orgName: z.string().optional(),
    createdAt: isoDate().optional(),
    matched: z.enum(["pdf", "json"]).optional(),
  }),
);

/* ─── Local (not in the core contract) ───────────────── */

export const HealthResponseSchema = z.object({ ok: z.literal(true) });
export const NotificationPrefsSchema = registry.register("NotificationPrefs", z.object({ alertEmails: z.boolean() }));
