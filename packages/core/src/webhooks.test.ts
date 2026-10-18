import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "./webhooks";

const secret = "whsec_test_secret";
const payload = JSON.stringify({ id: "evt_1", type: "alert.created", data: { id: "a1" } });

describe("webhook signatures", () => {
  it("round-trips", () => {
    const header = signWebhookPayload(secret, payload, 1_700_000_000);
    expect(verifyWebhookSignature({ payload, header, secret, now: 1_700_000_010 })).toEqual({ ok: true, timestamp: 1_700_000_000 });
  });

  it("rejects a tampered body, a wrong secret and a stale timestamp", () => {
    const header = signWebhookPayload(secret, payload, 1_700_000_000);
    expect(verifyWebhookSignature({ payload: payload + " ", header, secret, now: 1_700_000_000 })).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyWebhookSignature({ payload, header, secret: "other", now: 1_700_000_000 })).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyWebhookSignature({ payload, header, secret, now: 1_700_000_000 + 301 })).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects malformed headers", () => {
    expect(verifyWebhookSignature({ payload, header: undefined, secret }).ok).toBe(false);
    expect(verifyWebhookSignature({ payload, header: "t=abc,v1=zz", secret })).toEqual({ ok: false, reason: "malformed" });
  });
});
