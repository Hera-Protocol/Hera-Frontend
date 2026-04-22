export type UiCaseStatus = "CREATED" | "SCANNING" | "SIGNED" | "FAILED";
export type UiChain = "Zcash" | "Namada";
export type UiNetwork = "Mainnet" | "Testnet" | "Regtest";
export type UiScanStage =
  | "CREATED"
  | "KEY_VALIDATED"
  | "CHAIN_SYNCING"
  | "DETECTING_NOTES"
  | "CLASSIFYING_FLOWS"
  | "BUILDING_REPORT"
  | "SIGNED";

export const SCAN_STAGES: UiScanStage[] = [
  "CREATED",
  "KEY_VALIDATED",
  "CHAIN_SYNCING",
  "DETECTING_NOTES",
  "CLASSIFYING_FLOWS",
  "BUILDING_REPORT",
  "SIGNED",
];

type ApiChain = "ZCASH" | "NAMADA";
type ApiNetwork = "MAINNET" | "TESTNET" | "REGTEST";
type ApiScanStatus = UiScanStage | { FAILED: string };

interface ApiPaginatedResponse<T> {
  items: T[];
  limit: number;
  offset: number;
}

interface ApiWorkspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ApiWorkspaceCreateResponse {
  id: string;
  name: string;
}

interface ApiCase {
  id: string;
  workspace_id: string;
  chain: ApiChain;
  network: ApiNetwork;
  case_status: string;
  scan_status: ApiScanStatus;
  created_at: string;
  updated_at: string;
}

interface ApiCaseDetail extends ApiCase {
  last_checkpoint: number | null;
}

interface ApiCaseEvent {
  event_id: string;
  txid: string;
  block_height: number;
  timestamp: string;
  event_type: "SHIELD" | "RECEIVE" | "SEND" | "UNSHIELD" | "FEE";
  asset: {
    symbol: string;
    asset_id: string;
    decimals: number;
  };
  amount: string;
  counterparty: {
    visibility: "KNOWN" | "UNKNOWN" | "PARTIAL";
    value: string | null;
  };
}

interface ApiWorkspaceReport {
  case_id: string;
  chain: ApiChain;
  network: ApiNetwork;
  status: string;
  json_sha256: string;
  pdf_sha256: string;
  created_at: string;
  updated_at: string;
}

interface ApiWorkspaceViewKey {
  id: string;
  case_id: string;
  chain: ApiChain;
  key_ref: string;
  birthday_height: number | null;
  created_at: string;
  updated_at: string;
}

interface ApiAuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  resource_id: string;
  resource_type: string;
  ip_addr: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface HeraClientConfig {
  apiBaseUrl: string;
  apiKey: string;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseSummary {
  id: string;
  workspaceId: string;
  chain: UiChain;
  network: UiNetwork;
  caseStatus: string;
  status: UiCaseStatus;
  scanStage: UiScanStage | "FAILED";
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetail extends CaseSummary {
  lastCheckpoint: number | null;
}

export interface TimelineEvent {
  id: string;
  txid: string;
  blockHeight: number;
  timestamp: string;
  eventType: "RECEIVE" | "SEND" | "SHIELD" | "UNSHIELD" | "FEE";
  asset: string;
  amount: string;
  counterpartyVisibility: "KNOWN" | "UNKNOWN" | "PARTIAL";
  counterpartyValue?: string;
  ownershipProof: "CRYPTOGRAPHIC";
}

export interface WorkspaceReport {
  caseId: string;
  chain: UiChain;
  network: UiNetwork;
  status: string;
  jsonSha256: string;
  pdfSha256: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceViewKey {
  id: string;
  caseId: string;
  chain: UiChain;
  keyRef: string;
  birthdayHeight: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  resourceId: string;
  resourceType: string;
  ipAddr: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export class HeraApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "HeraApiError";
    this.status = status;
    this.code = code;
  }
}

function authHeaders(config: HeraClientConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.apiKey}`,
  };
}

async function requestJson<T>(
  config: HeraClientConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(config),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorCode: string | undefined;

    try {
      const body = (await response.json()) as ApiErrorEnvelope;
      errorMessage = body.error?.message ?? errorMessage;
      errorCode = body.error?.code;
    } catch {
      // Ignore JSON parsing failures and keep the generic message.
    }

    throw new HeraApiError(errorMessage, response.status, errorCode);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestArtifact(
  config: HeraClientConfig,
  path: string
): Promise<{ blob: Blob; sha256: string | null }> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: authHeaders(config),
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorCode: string | undefined;

    try {
      const body = (await response.json()) as ApiErrorEnvelope;
      errorMessage = body.error?.message ?? errorMessage;
      errorCode = body.error?.code;
    } catch {
      // Ignore JSON parsing failures and keep the generic message.
    }

    throw new HeraApiError(errorMessage, response.status, errorCode);
  }

  return {
    blob: await response.blob(),
    sha256: response.headers.get("x-artifact-sha256"),
  };
}

function toUiChain(chain: ApiChain): UiChain {
  return chain === "ZCASH" ? "Zcash" : "Namada";
}

function toUiNetwork(network: ApiNetwork): UiNetwork {
  if (network === "MAINNET") return "Mainnet";
  if (network === "TESTNET") return "Testnet";
  return "Regtest";
}

function parseScanStatus(scanStatus: ApiScanStatus): {
  status: UiCaseStatus;
  scanStage: UiScanStage | "FAILED";
  failureReason?: string;
} {
  if (typeof scanStatus === "string") {
    if (scanStatus === "CREATED") {
      return { status: "CREATED", scanStage: "CREATED" };
    }
    if (scanStatus === "SIGNED") {
      return { status: "SIGNED", scanStage: "SIGNED" };
    }

    return {
      status: "SCANNING",
      scanStage: scanStatus,
    };
  }

  return {
    status: "FAILED",
    scanStage: "FAILED",
    failureReason: scanStatus.FAILED,
  };
}

function mapCase(apiCase: ApiCase): CaseSummary {
  const parsedStatus = parseScanStatus(apiCase.scan_status);

  return {
    id: apiCase.id,
    workspaceId: apiCase.workspace_id,
    chain: toUiChain(apiCase.chain),
    network: toUiNetwork(apiCase.network),
    caseStatus: apiCase.case_status,
    status: parsedStatus.status,
    scanStage: parsedStatus.scanStage,
    failureReason: parsedStatus.failureReason,
    createdAt: apiCase.created_at,
    updatedAt: apiCase.updated_at,
  };
}

function mapCaseDetail(apiCase: ApiCaseDetail): CaseDetail {
  return {
    ...mapCase(apiCase),
    lastCheckpoint: apiCase.last_checkpoint,
  };
}

function mapEvent(event: ApiCaseEvent): TimelineEvent {
  return {
    id: event.event_id,
    txid: event.txid,
    blockHeight: event.block_height,
    timestamp: event.timestamp,
    eventType: event.event_type,
    asset: event.asset.symbol,
    amount: event.amount,
    counterpartyVisibility: event.counterparty.visibility,
    counterpartyValue: event.counterparty.value ?? undefined,
    ownershipProof: "CRYPTOGRAPHIC",
  };
}

function mapWorkspace(workspace: ApiWorkspace): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.created_at,
    updatedAt: workspace.updated_at,
  };
}

function mapReport(report: ApiWorkspaceReport): WorkspaceReport {
  return {
    caseId: report.case_id,
    chain: toUiChain(report.chain),
    network: toUiNetwork(report.network),
    status: report.status,
    jsonSha256: report.json_sha256,
    pdfSha256: report.pdf_sha256,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  };
}

function mapViewKey(key: ApiWorkspaceViewKey): WorkspaceViewKey {
  return {
    id: key.id,
    caseId: key.case_id,
    chain: toUiChain(key.chain),
    keyRef: key.key_ref,
    birthdayHeight: key.birthday_height,
    createdAt: key.created_at,
    updatedAt: key.updated_at,
  };
}

function mapAuditLog(entry: ApiAuditLogEntry): AuditLogEntry {
  return {
    id: entry.id,
    actorId: entry.actor_id,
    action: entry.action,
    resourceId: entry.resource_id,
    resourceType: entry.resource_type,
    ipAddr: entry.ip_addr,
    metadata: entry.metadata,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  };
}

function paginatedPath(path: string, limit = 100, offset = 0): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}limit=${limit}&offset=${offset}`;
}

export const heraApi = {
  async listWorkspaces(config: HeraClientConfig): Promise<Workspace[]> {
    const response = await requestJson<ApiPaginatedResponse<ApiWorkspace>>(
      config,
      paginatedPath("/v1/workspaces")
    );

    return response.items.map(mapWorkspace);
  },

  async createWorkspace(
    config: HeraClientConfig,
    input: { name: string }
  ): Promise<Workspace> {
    const response = await requestJson<ApiWorkspaceCreateResponse>(config, "/v1/workspaces", {
      method: "POST",
      body: JSON.stringify(input),
    });

    const timestamp = new Date().toISOString();

    return {
      id: response.id,
      name: response.name,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },

  async listCases(
    config: HeraClientConfig,
    workspaceId: string
  ): Promise<CaseSummary[]> {
    const response = await requestJson<ApiPaginatedResponse<ApiCase>>(
      config,
      paginatedPath(`/v1/workspaces/${workspaceId}/cases`)
    );

    return response.items.map(mapCase);
  },

  async getCase(
    config: HeraClientConfig,
    caseId: string
  ): Promise<CaseDetail> {
    const response = await requestJson<ApiCaseDetail>(config, `/v1/cases/${caseId}`);
    return mapCaseDetail(response);
  },

  async createCase(
    config: HeraClientConfig,
    input: { workspaceId: string; chain: UiChain; network: UiNetwork }
  ): Promise<{ id: string }> {
    return requestJson(config, "/v1/cases", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        chain: input.chain === "Zcash" ? "ZCASH" : "NAMADA",
        network: input.network.toUpperCase(),
      }),
    });
  },

  async importViewingKey(
    config: HeraClientConfig,
    input: {
      caseId: string;
      chain: UiChain;
      rawKey: string;
      birthdayHeight?: number;
    }
  ): Promise<{ key_ref: string }> {
    const chainPath = input.chain === "Zcash" ? "zcash" : "namada";

    return requestJson(config, `/v1/cases/${input.caseId}/${chainPath}/import-view-key`, {
      method: "POST",
      body: JSON.stringify({
        raw_key: input.rawKey,
        birthday_height: input.birthdayHeight ?? null,
      }),
    });
  },

  async startScan(
    config: HeraClientConfig,
    caseId: string
  ): Promise<{ job_id: string }> {
    return requestJson(config, `/v1/cases/${caseId}/scan`, {
      method: "POST",
      headers: authHeaders(config),
    });
  },

  async listCaseEvents(
    config: HeraClientConfig,
    caseId: string
  ): Promise<TimelineEvent[]> {
    const response = await requestJson<ApiCaseEvent[]>(config, `/v1/cases/${caseId}/events`);
    return response.map(mapEvent);
  },

  async listReports(
    config: HeraClientConfig,
    workspaceId: string
  ): Promise<WorkspaceReport[]> {
    const response = await requestJson<ApiPaginatedResponse<ApiWorkspaceReport>>(
      config,
      paginatedPath(`/v1/workspaces/${workspaceId}/reports`)
    );

    return response.items.map(mapReport);
  },

  async listViewKeys(
    config: HeraClientConfig,
    workspaceId: string
  ): Promise<WorkspaceViewKey[]> {
    const response = await requestJson<ApiPaginatedResponse<ApiWorkspaceViewKey>>(
      config,
      paginatedPath(`/v1/workspaces/${workspaceId}/keys`)
    );

    return response.items.map(mapViewKey);
  },

  async listAuditLogs(
    config: HeraClientConfig,
    workspaceId: string
  ): Promise<AuditLogEntry[]> {
    const response = await requestJson<ApiPaginatedResponse<ApiAuditLogEntry>>(
      config,
      paginatedPath(`/v1/workspaces/${workspaceId}/audit-logs`)
    );

    return response.items.map(mapAuditLog);
  },

  async downloadReport(
    config: HeraClientConfig,
    caseId: string,
    format: "json" | "pdf"
  ) {
    return requestArtifact(config, `/v1/cases/${caseId}/report.${format}`);
  },
};

export function formatDisplayId(id: string): string {
  return `CASE-${id.slice(0, 8)}`;
}
