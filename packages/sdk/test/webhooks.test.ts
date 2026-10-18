import { type AlertDto, signWebhookPayload } from "@hera/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { constructEvent, Hera, HERA_EVENT_ID_HEADER, HERA_SIGNATURE_HEADER, type HeraWebhookEvent, HeraWebhookSignatureError } from "../src";

const SECRET = "whsec_test_secret_value";
const NOW = 1_760_000_000;

const alert: AlertDto = {
  id: "a1",
  chain: "stellar",
  subjectDisplay: "GA5Z…KZVN",
  reasonCode: "COUNTERPARTY_EXPOSURE",
  title: "Received from a mixer",
  detail: "",
  severity: "high",
  status: "open",
  score: 72,
  notes: [],
  createdAt: "2026-10-18T00:00:00.000Z",
  updatedAt: "2026-10-18T00:00:00.000Z",
};

const event = { id: "evt_1", type: "alert.created", createdAt: "2026-10-18T00:00:00.000Z", orgId: "org_1", data: alert };
const body = JSON.stringify(event);
const header = signWebhookPayload(SECRET, body, NOW);

function reasonOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(HeraWebhookSignatureError);
    return (error as HeraWebhookSignatureError).reason;
  }
  return undefined;
}

describe("Hera.webhooks.constructEvent", () => {
  it("round-trips an event signed with core's signWebhookPayload", () => {
    const verified = Hera.webhooks.constructEvent(body, header, SECRET, { now: NOW });
    expect(verified).toEqual(event);
    expect(constructEvent(new TextEncoder().encode(body), [header], SECRET, { now: NOW + 10 })).toEqual(event);
  });

  it("narrows data by type", () => {
    const verified = constructEvent(body, header, SECRET, { now: NOW });
    if (verified.type === "alert.created") expectTypeOf(verified.data).toEqualTypeOf<AlertDto>();
    if (verified.type === "wallet.activity") expectTypeOf(verified.data.newTransfers).toBeNumber();
    if (verified.type === "report.ready") expectTypeOf(verified.data.reference).toBeString();
    expectTypeOf<HeraWebhookEvent["type"]>().toEqualTypeOf<
      "screening.completed" | "alert.created" | "alert.updated" | "wallet.activity" | "travel_rule.updated" | "report.ready"
    >();
  });

  it("rejects a tampered body", () => {
    expect(reasonOf(() => constructEvent(body.replace("72", "12"), header, SECRET, { now: NOW }))).toBe("mismatch");
  });

  it("rejects re-serialized JSON with different whitespace", () => {
    expect(reasonOf(() => constructEvent(JSON.stringify(event, null, 2), header, SECRET, { now: NOW }))).toBe("mismatch");
  });

  it("rejects the wrong secret", () => {
    expect(reasonOf(() => constructEvent(body, header, "whsec_other", { now: NOW }))).toBe("mismatch");
  });

  it("rejects old signatures (replay) outside the tolerance", () => {
    expect(reasonOf(() => constructEvent(body, header, SECRET, { now: NOW + 301 }))).toBe("expired");
    expect(constructEvent(body, header, SECRET, { now: NOW + 301, toleranceSeconds: 600 }).id).toBe("evt_1");
  });

  it("rejects missing or malformed headers", () => {
    expect(reasonOf(() => constructEvent(body, undefined, SECRET))).toBe("malformed");
    expect(reasonOf(() => constructEvent(body, "v1=abc", SECRET))).toBe("malformed");
  });

  it("explains when given a parsed body instead of the raw one", () => {
    expect(reasonOf(() => constructEvent(event as never, header, SECRET, { now: NOW }))).toBe("raw_body_required");
  });

  it("rejects a validly signed body that isn't an event", () => {
    const notEvent = JSON.stringify({ hello: "world" });
    expect(reasonOf(() => constructEvent(notEvent, signWebhookPayload(SECRET, notEvent, NOW), SECRET, { now: NOW }))).toBe("invalid_payload");
  });

  it("exports the header names", () => {
    expect(HERA_SIGNATURE_HEADER).toBe("hera-signature");
    expect(HERA_EVENT_ID_HEADER).toBe("hera-event-id");
    expect(Hera.webhooks.SIGNATURE_HEADER).toBe(HERA_SIGNATURE_HEADER);
  });
});
