import type { ApiErrorBody } from "@hera/core";

/** Every request goes to this origin; Next rewrites /api/* to the NestJS API. */
const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: "same-origin",
      // Always JSON: the API rejects cookie-authenticated mutations without it (CSRF guard).
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: body === undefined ? (method === "GET" ? undefined : "{}") : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network_error", "Can't reach Hera right now. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? safeJson(text) : undefined;

  if (!response.ok) {
    const err = (data as ApiErrorBody | undefined)?.error;
    const fallback =
      response.status >= 500 && !err
        ? "The Hera API isn't responding. Is it running on port 4000?"
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, err?.code ?? "http_error", err?.message ?? fallback, err?.fields);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>("POST", path, body, headers),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
