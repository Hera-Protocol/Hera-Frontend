export { Hera, DEFAULT_BASE_URL, type HeraOptions, type GuardOptions, type GuardResult } from "./client";
export {
  HeraError,
  HeraAuthError,
  HeraValidationError,
  HeraRateLimitError,
  HeraConnectionError,
  HeraBlockedError,
  HeraWebhookSignatureError,
  type HeraErrorInit,
  type WebhookSignatureFailure,
} from "./errors";
export type { FetchFn, RequestOptions } from "./http";
export type { Screenings, Wallets, Alerts, TravelRule, Reports, WaitOptions } from "./resources";
export type { ScreenInput } from "./validate";
export {
  webhooks,
  constructEvent,
  HERA_SIGNATURE_HEADER,
  HERA_EVENT_ID_HEADER,
  HERA_WEBHOOK_TOLERANCE_SECONDS,
  type HeraWebhookEvent,
  type HeraWebhookEventOf,
  type WebhookEventDataMap,
  type ConstructEventOptions,
} from "./webhooks";
export { SDK_VERSION } from "./version";

// Contract types, re-exported so integrators need only one import.
export type {
  AlertDto,
  AlertStatus,
  ChainId,
  CreateReportInput,
  CreateTravelRuleInput,
  CreateWalletInput,
  Decision,
  Disposition,
  IvmsPerson,
  Paginated,
  Reason,
  ReasonCode,
  ReportDto,
  ReportStatus,
  ReportType,
  RiskBand,
  ScreeningResponse,
  ScreeningSummaryDto,
  SubjectInput,
  SubjectRef,
  TravelRuleStatus,
  TravelRuleTransferDto,
  UpdateAlertInput,
  WalletDto,
  WebhookEventType,
} from "@hera/core";
