import { describe, expect, it } from "vitest";
import { HeraAuthError, HeraError, HeraRateLimitError, HeraValidationError } from "../src";
import { apiError, client, G, mockFetch } from "./helpers";

const noRetry = { maxRetries: 0 };

describe("error mapping", () => {
  it("401 and 403 become HeraAuthError with the API's code and message", async () => {
    for (const [status, code, message] of [
      [401, "unauthenticated", "Invalid or revoked API key."],
      [403, "forbidden", 'This API key is missing the "screen" scope.'],
    ] as const) {
      const { fetch } = mockFetch(apiError(status, code, message, { headers: { "x-request-id": "req_123" } }));
      const error = await client(fetch, noRetry).screen(G).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HeraAuthError);
      expect(error).toBeInstanceOf(HeraError);
      expect(error).toMatchObject({ status, code, message, requestId: "req_123", name: "HeraAuthError" });
    }
  });

  it("422 becomes HeraValidationError with fields", async () => {
    const { fetch } = mockFetch(apiError(422, "validation_failed", "Some fields need attention.", { fields: { address: "Bad" } }));
    const error = await client(fetch).screen(G).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HeraValidationError);
    expect(error).toMatchObject({ status: 422, fields: { address: "Bad" } });
  });

  it("429 becomes HeraRateLimitError with retryAfter in seconds", async () => {
    const { fetch } = mockFetch(apiError(429, "rate_limited", "Too many requests. Try again in a minute.", { headers: { "retry-after": "30" } }));
    const error = await client(fetch, noRetry).screen(G).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HeraRateLimitError);
    expect(error).toMatchObject({ status: 429, code: "rate_limited", retryAfter: 30 });
  });

  it("other statuses become a plain HeraError", async () => {
    const { fetch } = mockFetch(apiError(409, "invalid_transition", "A transfer can't move from draft to settled."));
    const error = await client(fetch).travelRule.transition("0b9c2c62-5f37-4c8e-9a51-3f0c7c1c0d11", "settled").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HeraError);
    expect(error).not.toBeInstanceOf(HeraAuthError);
    expect(error).toMatchObject({ status: 409, code: "invalid_transition" });
  });

  it("non-JSON error bodies (e.g. a proxy's HTML 502) still map cleanly", async () => {
    const { fetch } = mockFetch(new Response("<html>Bad gateway</html>", { status: 502 }));
    const error = await client(fetch, noRetry).wallets.list().catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: "internal_error", message: "Hera API responded with HTTP 502." });
  });

  it("a 200 that isn't JSON is an invalid_response error", async () => {
    const { fetch } = mockFetch(new Response("ok", { status: 200 }));
    await expect(client(fetch).wallets.list()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("never puts the key in error messages", async () => {
    const { fetch } = mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    const error = (await client(fetch, noRetry).wallets.list().catch((e: unknown) => e)) as HeraError;
    expect(error.name).toBe("HeraConnectionError");
    expect(error.message).not.toMatch(/hera_live_/);
  });
});
