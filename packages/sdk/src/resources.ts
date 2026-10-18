import type {
  AlertDto,
  AlertStatus,
  CreateReportInput,
  CreateTravelRuleInput,
  CreateWalletInput,
  Paginated,
  ReportDto,
  ScreeningResponse,
  ScreeningSummaryDto,
  TravelRuleStatus,
  TravelRuleTransferDto,
  UpdateAlertInput,
  WalletDto,
} from "@hera/core";
import { HeraError } from "./errors";
import type { RequestOptions, Transport } from "./http";
import {
  assertId,
  validateAlertUpdate,
  validateReport,
  validateTransition,
  validateTravelRule,
  validateWallet,
} from "./validate";

const seg = (id: string, what: string) => encodeURIComponent(assertId(id, what));

/** Scope: `read`. */
export class Screenings {
  constructor(private readonly t: Transport) {}

  /** Most recent first. `limit` defaults to 50 on the server, max 200. */
  async list(params: { limit?: number } = {}, options?: RequestOptions): Promise<Paginated<ScreeningSummaryDto>> {
    return this.t.request({ method: "GET", path: "/screenings", query: { limit: params.limit } }, options);
  }

  async get(id: string, options?: RequestOptions): Promise<ScreeningResponse> {
    return this.t.request({ method: "GET", path: `/screenings/${seg(id, "screening")}` }, options);
  }
}

/** Watchlist for post-transaction monitoring. `list` needs `read`; `watch`, `unwatch` and `refresh` need `monitor`. */
export class Wallets {
  constructor(private readonly t: Transport) {}

  async list(options?: RequestOptions): Promise<WalletDto[]> {
    return this.t.request({ method: "GET", path: "/wallets" }, options);
  }

  /** Start monitoring an address. Hera rescreens it on an interval and opens alerts (and webhooks) on new risk. */
  async watch(input: CreateWalletInput, options?: RequestOptions): Promise<WalletDto> {
    return this.t.request({ method: "POST", path: "/wallets", body: validateWallet(input) }, options);
  }

  async unwatch(id: string, options?: RequestOptions): Promise<void> {
    return this.t.request({ method: "DELETE", path: `/wallets/${seg(id, "wallet")}`, expect: "none" }, options);
  }

  /** Rescreen now instead of waiting for the monitor. */
  async refresh(id: string, options?: RequestOptions): Promise<WalletDto> {
    return this.t.request({ method: "POST", path: `/wallets/${seg(id, "wallet")}/refresh` }, options);
  }
}

/** Scope: `read` for list/get. */
export class Alerts {
  constructor(private readonly t: Transport) {}

  async list(params: { status?: AlertStatus } = {}, options?: RequestOptions): Promise<AlertDto[]> {
    return this.t.request({ method: "GET", path: "/alerts", query: { status: params.status } }, options);
  }

  async get(id: string, options?: RequestOptions): Promise<AlertDto> {
    return this.t.request({ method: "GET", path: `/alerts/${seg(id, "alert")}` }, options);
  }

  /** Move an alert through `open → in_review → escalated → closed`. Closing needs a disposition and a note. */
  async update(id: string, input: UpdateAlertInput, options?: RequestOptions): Promise<AlertDto> {
    return this.t.request({ method: "PATCH", path: `/alerts/${seg(id, "alert")}`, body: validateAlertUpdate(input) }, options);
  }
}

/** Scope: `travel_rule`. */
export class TravelRule {
  constructor(private readonly t: Transport) {}

  /** Records an IVMS101 transfer. Accounts are validated (muxed and memo included) before the call. */
  async create(input: CreateTravelRuleInput, options?: RequestOptions): Promise<TravelRuleTransferDto> {
    return this.t.request({ method: "POST", path: "/travel-rule/transfers", body: validateTravelRule(input) }, options);
  }

  async list(options?: RequestOptions): Promise<TravelRuleTransferDto[]> {
    return this.t.request({ method: "GET", path: "/travel-rule/transfers" }, options);
  }

  async get(id: string, options?: RequestOptions): Promise<TravelRuleTransferDto> {
    return this.t.request({ method: "GET", path: `/travel-rule/transfers/${seg(id, "transfer")}` }, options);
  }

  /** Invalid moves (e.g. draft → settled) come back as a 409 `invalid_transition` HeraError. */
  async transition(id: string, to: TravelRuleStatus, note?: string, options?: RequestOptions): Promise<TravelRuleTransferDto> {
    return this.t.request(
      { method: "POST", path: `/travel-rule/transfers/${seg(id, "transfer")}/transition`, body: validateTransition(to, note) },
      options,
    );
  }
}

export interface WaitOptions extends RequestOptions {
  /** Give up after this long. Default 60 s. */
  timeoutMs?: number;
  /** Poll interval. Default 1 s. */
  intervalMs?: number;
}

/** Compliance PDFs with a frozen JSON snapshot. Scope: `read`. */
export class Reports {
  constructor(private readonly t: Transport) {}

  async create(input: CreateReportInput, options?: RequestOptions): Promise<ReportDto> {
    return this.t.request({ method: "POST", path: "/reports", body: validateReport(input) }, options);
  }

  async list(options?: RequestOptions): Promise<ReportDto[]> {
    return this.t.request({ method: "GET", path: "/reports" }, options);
  }

  async get(id: string, options?: RequestOptions): Promise<ReportDto> {
    return this.t.request({ method: "GET", path: `/reports/${seg(id, "report")}` }, options);
  }

  /** The PDF bytes. Write them to disk or stream them to the user as `application/pdf`. */
  async download(id: string, options?: RequestOptions): Promise<Uint8Array<ArrayBuffer>> {
    return this.t.request(
      { method: "GET", path: `/reports/${seg(id, "report")}/pdf`, expect: "bytes", accept: "application/pdf" },
      options,
    );
  }

  /** The frozen JSON snapshot the PDF was rendered from. Its SHA-256 is `report.jsonSha256`. */
  async snapshot<T = Record<string, unknown>>(id: string, options?: RequestOptions): Promise<T> {
    return this.t.request({ method: "GET", path: `/reports/${seg(id, "report")}/json` }, options);
  }

  /** Polls until the report is `ready`. Throws when it fails or the wait times out. */
  async waitUntilReady(id: string, options: WaitOptions = {}): Promise<ReportDto> {
    const { timeoutMs = 60_000, intervalMs = 1_000, signal, maxRetries } = options;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const report = await this.get(id, { signal, maxRetries });
      if (report.status === "ready") return report;
      if (report.status === "failed") {
        throw new HeraError({ code: "report_failed", message: report.error ?? `Report ${report.reference} failed to render.` });
      }
      if (Date.now() + intervalMs > deadline) {
        throw new HeraError({ code: "report_timeout", message: `Report ${report.reference} was still ${report.status} after ${timeoutMs} ms.` });
      }
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, intervalMs);
        signal?.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
      });
    }
  }
}
