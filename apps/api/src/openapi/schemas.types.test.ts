/**
 * The OpenAPI response schemas are documentation only, so these assertions are
 * what keeps them honest: each `z.infer` must equal the @hera/core DTO exactly.
 * They're checked by `tsc` (pnpm typecheck); the runtime part is trivial.
 */
import type {
  AlertDto,
  ApiErrorBody,
  ApiKeyDto,
  AuditEventDto,
  AuditVerifyResponse,
  ChainDto,
  CounterpartySummary,
  CreateApiKeyResponse,
  CreateWebhookResponse,
  InviteDto,
  InviteLookupResponse,
  IvmsPerson,
  Label,
  MeResponse,
  MemberDto,
  MembershipDto,
  OkResponse,
  OrgDetailResponse,
  OrgDto,
  OverviewResponse,
  Paginated,
  Reason,
  ReasonCode,
  ReportDto,
  ReportVerifyResponse,
  ScreeningResponse,
  ScreeningResult,
  ScreeningSummaryDto,
  SubjectProfile,
  SubjectRef,
  Transfer,
  TravelRuleCheck,
  TravelRuleEventDto,
  TravelRuleTransferDto,
  UserDto,
  WalletDto,
  WebhookDeliveryDto,
  WebhookEndpointDto,
  WebhookEvent,
} from "@hera/core";
import { describe, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type * as S from "./schemas";

type Infer<T extends z.ZodTypeAny> = z.infer<T>;

describe("OpenAPI response schemas match the core DTOs", () => {
  it("shared and auth", () => {
    expectTypeOf<Infer<typeof S.ApiErrorBodySchema>>().toEqualTypeOf<ApiErrorBody>();
    expectTypeOf<Infer<typeof S.OkResponseSchema>>().toEqualTypeOf<OkResponse>();
    expectTypeOf<Infer<typeof S.SubjectRefSchema>>().toEqualTypeOf<SubjectRef>();
    expectTypeOf<Infer<typeof S.UserDtoSchema>>().toEqualTypeOf<UserDto>();
    expectTypeOf<Infer<typeof S.OrgDtoSchema>>().toEqualTypeOf<OrgDto>();
    expectTypeOf<Infer<typeof S.MeResponseSchema>>().toEqualTypeOf<MeResponse>();
    expectTypeOf<Infer<typeof S.MemberDtoSchema>>().toEqualTypeOf<MemberDto>();
    expectTypeOf<Infer<typeof S.OrgDetailResponseSchema>>().toEqualTypeOf<OrgDetailResponse>();
    expectTypeOf<Infer<typeof S.MembershipDtoSchema>>().toEqualTypeOf<MembershipDto>();
    expectTypeOf<Infer<typeof S.InviteDtoSchema>>().toEqualTypeOf<InviteDto>();
    expectTypeOf<Infer<typeof S.InviteLookupResponseSchema>>().toEqualTypeOf<InviteLookupResponse>();
    expectTypeOf<Infer<typeof S.ChainDtoSchema>>().toEqualTypeOf<ChainDto>();
  });

  it("screening", () => {
    expectTypeOf<(typeof S.REASON_CODES)[number]>().toEqualTypeOf<ReasonCode>();
    expectTypeOf<Infer<typeof S.LabelSchema>>().toEqualTypeOf<Label>();
    expectTypeOf<Infer<typeof S.ReasonSchema>>().toEqualTypeOf<Reason>();
    expectTypeOf<Infer<typeof S.TransferSchema>>().toEqualTypeOf<Transfer>();
    expectTypeOf<Infer<typeof S.CounterpartySummarySchema>>().toEqualTypeOf<CounterpartySummary>();
    expectTypeOf<Infer<typeof S.SubjectProfileSchema>>().toEqualTypeOf<SubjectProfile>();
    expectTypeOf<Infer<typeof S.ScreeningResultSchema>>().toEqualTypeOf<ScreeningResult>();
    expectTypeOf<Infer<typeof S.ScreeningResponseSchema>>().toEqualTypeOf<ScreeningResponse>();
    expectTypeOf<Infer<typeof S.ScreeningSummaryDtoSchema>>().toEqualTypeOf<ScreeningSummaryDto>();
    expectTypeOf<Infer<typeof S.PaginatedScreeningsSchema>>().toEqualTypeOf<Paginated<ScreeningSummaryDto>>();
  });

  it("wallets, alerts, travel rule", () => {
    expectTypeOf<Infer<typeof S.WalletDtoSchema>>().toEqualTypeOf<WalletDto>();
    expectTypeOf<Infer<typeof S.AlertDtoSchema>>().toEqualTypeOf<AlertDto>();
    expectTypeOf<Infer<typeof S.IvmsPersonSchema>>().toEqualTypeOf<IvmsPerson>();
    expectTypeOf<Infer<typeof S.TravelRuleCheckSchema>>().toEqualTypeOf<TravelRuleCheck>();
    expectTypeOf<Infer<typeof S.TravelRuleEventDtoSchema>>().toEqualTypeOf<TravelRuleEventDto>();
    expectTypeOf<Infer<typeof S.TravelRuleTransferDtoSchema>>().toEqualTypeOf<TravelRuleTransferDto>();
  });

  it("keys, audit, overview", () => {
    expectTypeOf<Infer<typeof S.ApiKeyDtoSchema>>().toEqualTypeOf<ApiKeyDto>();
    expectTypeOf<Infer<typeof S.CreateApiKeyResponseSchema>>().toEqualTypeOf<CreateApiKeyResponse>();
    expectTypeOf<Infer<typeof S.AuditEventDtoSchema>>().toEqualTypeOf<AuditEventDto>();
    expectTypeOf<Infer<typeof S.AuditVerifyResponseSchema>>().toEqualTypeOf<AuditVerifyResponse>();
    expectTypeOf<Infer<typeof S.OverviewResponseSchema>>().toEqualTypeOf<OverviewResponse>();
  });

  it("webhooks and reports", () => {
    expectTypeOf<Infer<typeof S.WebhookEndpointDtoSchema>>().toEqualTypeOf<WebhookEndpointDto>();
    expectTypeOf<Infer<typeof S.CreateWebhookResponseSchema>>().toEqualTypeOf<CreateWebhookResponse>();
    expectTypeOf<Infer<typeof S.WebhookDeliveryDtoSchema>>().toEqualTypeOf<WebhookDeliveryDto>();
    // zod 3 marks `unknown` keys optional, so compare the envelope without `data`.
    expectTypeOf<Omit<Infer<typeof S.WebhookEventSchema>, "data">>().toEqualTypeOf<Omit<WebhookEvent, "data">>();
    expectTypeOf<Infer<typeof S.WalletActivityDataSchema>>().toEqualTypeOf<{ wallet: WalletDto; newTransfers: number }>();
    expectTypeOf<Infer<typeof S.ReportDtoSchema>>().toEqualTypeOf<ReportDto>();
    expectTypeOf<Infer<typeof S.ReportVerifyResponseSchema>>().toEqualTypeOf<ReportVerifyResponse>();
  });
});
