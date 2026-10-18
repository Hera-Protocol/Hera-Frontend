import http from "node:http";
import https from "node:https";
import net from "node:net";
import { BlockedAddressError, guardedLookup, isBlockedAddress } from "./ssrf";

export interface PostResult {
  /** HTTP status, when a response arrived. */
  status?: number;
  ok: boolean;
  /** First 1 KB of the response body (for non-2xx) or the transport error. */
  error?: string;
}

const MAX_ERROR_BYTES = 1024;

/**
 * POST a raw body. Redirects are not followed (a 3xx counts as failure), the
 * whole exchange is capped by `timeoutMs`, and with `guard` every resolved
 * address is checked against the SSRF blocklist before connecting.
 */
export function postRaw(url: string, body: string, headers: Record<string, string>, options: { timeoutMs: number; guard: boolean }): Promise<PostResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (result: PostResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return finish({ ok: false, error: "Invalid URL" });
    }
    const host = target.hostname.replace(/^\[|\]$/g, "");
    // Node skips `lookup` for IP literals, so check those directly.
    if (options.guard && net.isIP(host) && isBlockedAddress(host)) {
      return finish({ ok: false, error: new BlockedAddressError(host, host).message });
    }

    const client = target.protocol === "https:" ? https : http;
    const request = client.request(
      target,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) },
        ...(options.guard ? { lookup: guardedLookup as unknown as net.LookupFunction } : {}),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const ok = status >= 200 && status < 300;
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          if (size < MAX_ERROR_BYTES) chunks.push(chunk);
          size += chunk.length;
        });
        response.on("end", () => {
          if (ok) return finish({ ok, status });
          const text = Buffer.concat(chunks).subarray(0, MAX_ERROR_BYTES).toString("utf8");
          const redirect = status >= 300 && status < 400 ? `Redirect to ${response.headers.location ?? "?"} not followed. ` : "";
          finish({ ok, status, error: (redirect + text).slice(0, MAX_ERROR_BYTES) || `HTTP ${status}` });
        });
        response.on("error", (error) => finish({ ok: false, status, error: error.message.slice(0, MAX_ERROR_BYTES) }));
      },
    );
    timer = setTimeout(() => {
      request.destroy();
      finish({ ok: false, error: `Timed out after ${options.timeoutMs / 1000}s` });
    }, options.timeoutMs);
    request.on("error", (error) => finish({ ok: false, error: error.message.slice(0, MAX_ERROR_BYTES) }));
    request.end(body);
  });
}
