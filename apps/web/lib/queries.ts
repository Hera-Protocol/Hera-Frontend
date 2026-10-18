"use client";

import type {
  AlertDto,
  AlertStatus,
  ApiKeyDto,
  AuditEventDto,
  AuditVerifyResponse,
  ChainDto,
  CreateInviteInput,
  CreateReportInput,
  CreateWebhookInput,
  CreateWebhookResponse,
  InviteDto,
  InviteLookupResponse,
  AcceptInviteInput,
  MembershipDto,
  ReportDto,
  ReportVerifyResponse,
  Role,
  UpdateWebhookInput,
  WebhookDeliveryDto,
  WebhookEndpointDto,
  CreateApiKeyInput,
  CreateApiKeyResponse,
  CreateTravelRuleInput,
  CreateWalletInput,
  LoginInput,
  MeResponse,
  OrgDetailResponse,
  OverviewResponse,
  Paginated,
  ScreeningResponse,
  ScreeningSummaryDto,
  ScreenRequest,
  SignupInput,
  TravelRuleStatus,
  TravelRuleTransferDto,
  UpdateAlertInput,
  WalletDto,
} from "@hera/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "./api";

export const keys = {
  me: ["me"] as const,
  overview: ["overview"] as const,
  chains: ["chains"] as const,
  screenings: ["screenings"] as const,
  screening: (id: string) => ["screenings", id] as const,
  wallets: ["wallets"] as const,
  alerts: (status?: AlertStatus | "all") => ["alerts", status ?? "all"] as const,
  alert: (id: string) => ["alert", id] as const,
  travelRule: ["travel-rule"] as const,
  transfer: (id: string) => ["travel-rule", id] as const,
  apiKeys: ["api-keys"] as const,
  audit: ["audit"] as const,
  org: ["org"] as const,
  orgs: ["me", "orgs"] as const,
  invites: ["invites"] as const,
  webhooks: ["webhooks"] as const,
  deliveries: (id: string) => ["webhooks", id, "deliveries"] as const,
  reports: ["reports"] as const,
  report: (id: string) => ["reports", id] as const,
};

/* ─── Auth ───────────────────────────────────────────── */

/** Resolves to null when signed out, so callers can branch without try/catch. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api.get<MeResponse>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<MeResponse>("/auth/login", input),
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => api.post<MeResponse>("/auth/signup", input),
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (input: { email: string }) => api.post<void>("/auth/forgot-password", input) });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; password: string }) => api.post<void>("/auth/reset-password", input),
    // The API revokes every session on reset.
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.patch<MeResponse>("/me", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

/* ─── Org ────────────────────────────────────────────── */

export function useOrg() {
  return useQuery({ queryKey: keys.org, queryFn: () => api.get<OrgDetailResponse>("/org") });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.patch<OrgDetailResponse>("/org", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.org });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/* ─── Overview & chains ──────────────────────────────── */

export function useOverview() {
  return useQuery({ queryKey: keys.overview, queryFn: () => api.get<OverviewResponse>("/overview"), refetchInterval: 30_000 });
}

export function useChains() {
  return useQuery({ queryKey: keys.chains, queryFn: () => api.get<ChainDto[]>("/chains"), staleTime: Infinity });
}

/* ─── Screening ──────────────────────────────────────── */

export function useScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ScreenRequest) => api.post<ScreeningResponse>("/screen", input),
    onSuccess: (result) => {
      qc.setQueryData(keys.screening(result.id), result);
      qc.invalidateQueries({ queryKey: keys.screenings });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export function useScreenings(limit = 20) {
  return useQuery({
    queryKey: [...keys.screenings, limit],
    queryFn: () => api.get<Paginated<ScreeningSummaryDto>>(`/screenings?limit=${limit}`),
  });
}

export function useScreening(id: string | null) {
  return useQuery({
    queryKey: keys.screening(id ?? ""),
    queryFn: () => api.get<ScreeningResponse>(`/screenings/${id}`),
    enabled: Boolean(id),
  });
}

/* ─── Wallets ────────────────────────────────────────── */

export function useWallets() {
  return useQuery({ queryKey: keys.wallets, queryFn: () => api.get<WalletDto[]>("/wallets") });
}

function useWalletMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.wallets });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export const useCreateWallet = () => useWalletMutation((input: CreateWalletInput) => api.post<WalletDto>("/wallets", input));
export const useRefreshWallet = () => useWalletMutation((id: string) => api.post<WalletDto>(`/wallets/${id}/refresh`));
export const useDeleteWallet = () => useWalletMutation((id: string) => api.delete<void>(`/wallets/${id}`));

/* ─── Alerts ─────────────────────────────────────────── */

export function useAlerts(status: AlertStatus | "all" = "all") {
  return useQuery({
    queryKey: keys.alerts(status),
    queryFn: () => api.get<AlertDto[]>(status === "all" ? "/alerts" : `/alerts?status=${status}`),
  });
}

export function useUpdateAlert(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAlertInput) => api.patch<AlertDto>(`/alerts/${id}`, input),
    onSuccess: (alert) => {
      qc.setQueryData(keys.alert(id), alert);
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

/* ─── Travel Rule ────────────────────────────────────── */

export function useTravelRuleTransfers() {
  return useQuery({ queryKey: keys.travelRule, queryFn: () => api.get<TravelRuleTransferDto[]>("/travel-rule/transfers") });
}

export function useTravelRuleTransfer(id: string) {
  return useQuery({ queryKey: keys.transfer(id), queryFn: () => api.get<TravelRuleTransferDto>(`/travel-rule/transfers/${id}`) });
}

export function useCreateTravelRule() {
  const qc = useQueryClient();
  return useMutation({
    // One key per submit attempt: a retried request after a timeout can't create a duplicate transfer.
    mutationFn: (input: CreateTravelRuleInput) =>
      api.post<TravelRuleTransferDto>("/travel-rule/transfers", input, { "Idempotency-Key": crypto.randomUUID() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.travelRule });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export function useTransitionTravelRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { to: TravelRuleStatus; note?: string }) =>
      api.post<TravelRuleTransferDto>(`/travel-rule/transfers/${id}/transition`, input),
    onSuccess: (transfer) => {
      qc.setQueryData(keys.transfer(id), transfer);
      qc.invalidateQueries({ queryKey: keys.travelRule });
    },
  });
}

/* ─── API keys ───────────────────────────────────────── */

export function useApiKeys() {
  return useQuery({ queryKey: keys.apiKeys, queryFn: () => api.get<ApiKeyDto[]>("/keys") });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => api.post<CreateApiKeyResponse>("/keys", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.apiKeys }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.apiKeys }),
  });
}

/* ─── Audit ──────────────────────────────────────────── */

export function useAudit() {
  return useQuery({ queryKey: keys.audit, queryFn: () => api.get<AuditEventDto[]>("/audit?limit=200") });
}

export function useVerifyAudit() {
  return useMutation({ mutationFn: () => api.get<AuditVerifyResponse>("/audit/verify") });
}

/* ─── Email verification ─────────────────────────────── */

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string }) => api.post<{ ok: true }>("/auth/verify-email", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: () => api.post<{ ok: true }>("/auth/resend-verification") });
}

/* ─── Team: invites, members, org switching ──────────── */

export function useInvites() {
  return useQuery({ queryKey: keys.invites, queryFn: () => api.get<InviteDto[]>("/invites") });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInviteInput) => api.post<InviteDto>("/invites", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites }),
  });
}

export function useResendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<InviteDto>(`/invites/${id}/resend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites }),
  });
}

export function useInviteLookup(token: string | null) {
  return useQuery({
    queryKey: ["invite-lookup", token],
    queryFn: () => api.get<InviteLookupResponse>(`/invites/lookup?token=${encodeURIComponent(token ?? "")}`),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AcceptInviteInput) => api.post<MeResponse>("/invites/accept", input),
    onSuccess: (me) => {
      qc.clear();
      qc.setQueryData(keys.me, me);
    },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: Role }) => api.patch<void>(`/org/members/${input.userId}`, { role: input.role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.org }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<void>(`/org/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.org }),
  });
}

export function useMyOrgs() {
  return useQuery({ queryKey: keys.orgs, queryFn: () => api.get<MembershipDto[]>("/me/orgs") });
}

export function useSwitchOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => api.post<MeResponse>("/auth/switch-org", { orgId }),
    onSuccess: (me) => {
      qc.clear();
      qc.setQueryData(keys.me, me);
    },
  });
}

/* ─── Webhooks ───────────────────────────────────────── */

export function useWebhooks() {
  return useQuery({ queryKey: keys.webhooks, queryFn: () => api.get<WebhookEndpointDto[]>("/webhooks") });
}

export function useWebhookDeliveries(id: string | null) {
  return useQuery({
    queryKey: keys.deliveries(id ?? ""),
    queryFn: () => api.get<WebhookDeliveryDto[]>(`/webhooks/${id}/deliveries?limit=50`),
    enabled: Boolean(id),
    refetchInterval: 10_000,
  });
}

function useWebhookMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: keys.webhooks }) });
}

export const useCreateWebhook = () => useWebhookMutation((input: CreateWebhookInput) => api.post<CreateWebhookResponse>("/webhooks", input));
export const useUpdateWebhook = () =>
  useWebhookMutation((input: { id: string } & UpdateWebhookInput) => {
    const { id, ...body } = input;
    return api.patch<WebhookEndpointDto>(`/webhooks/${id}`, body);
  });
export const useDeleteWebhook = () => useWebhookMutation((id: string) => api.delete<void>(`/webhooks/${id}`));
export const useRotateWebhookSecret = () => useWebhookMutation((id: string) => api.post<CreateWebhookResponse>(`/webhooks/${id}/rotate-secret`));
export const useTestWebhook = () => useWebhookMutation((id: string) => api.post<WebhookDeliveryDto>(`/webhooks/${id}/test`));
export const useRedeliver = () => useWebhookMutation((deliveryId: string) => api.post<WebhookDeliveryDto>(`/webhooks/deliveries/${deliveryId}/redeliver`));

/* ─── Reports ────────────────────────────────────────── */

export function useReports() {
  return useQuery({
    queryKey: keys.reports,
    queryFn: () => api.get<ReportDto[]>("/reports"),
    // Poll while anything is still rendering.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => r.status === "queued" || r.status === "rendering") ? 3_000 : false,
  });
}

export function useReport(id: string) {
  return useQuery({ queryKey: keys.report(id), queryFn: () => api.get<ReportDto>(`/reports/${id}`) });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReportInput) => api.post<ReportDto>("/reports", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reports }),
  });
}

/** Same-origin download URLs; the browser sends the session cookie. */
export const reportPdfUrl = (id: string) => `/api/v1/reports/${id}/pdf`;
export const reportJsonUrl = (id: string) => `/api/v1/reports/${id}/json`;

export function useVerifyReport() {
  return useMutation({
    mutationFn: (sha256: string) => api.get<ReportVerifyResponse>(`/reports/verify?sha256=${encodeURIComponent(sha256)}`),
  });
}
