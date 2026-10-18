import { describe, expect, it } from "vitest";
import { canTransition, checkTravelRule, originatorHasIdentifier } from "./travel-rule";

describe("checkTravelRule", () => {
  it("applies the US $3,000 threshold", () => {
    expect(checkTravelRule({ amountUsd: 2999, jurisdiction: "US", counterpartyHosted: true }).required).toBe(false);
    expect(checkTravelRule({ amountUsd: 3000, jurisdiction: "US", counterpartyHosted: true }).required).toBe(true);
  });

  it("requires data for every EU transfer and proof of control for large unhosted ones", () => {
    expect(checkTravelRule({ amountUsd: 1, jurisdiction: "EU", counterpartyHosted: true }).required).toBe(true);
    expect(checkTravelRule({ amountUsd: 500, jurisdiction: "EU", counterpartyHosted: false }).unhostedProofRequired).toBe(false);
    expect(checkTravelRule({ amountUsd: 5000, jurisdiction: "EU", counterpartyHosted: false }).unhostedProofRequired).toBe(true);
  });
});

describe("IVMS101 helpers", () => {
  it("needs an identifier beyond the name", () => {
    expect(originatorHasIdentifier({ type: "natural", firstName: "Ada", lastName: "L" })).toBe(false);
    expect(originatorHasIdentifier({ type: "natural", firstName: "Ada", lastName: "L", customerId: "c-1" })).toBe(true);
    expect(originatorHasIdentifier({ type: "natural", firstName: "Ada", lastName: "L", dateOfBirth: "1990-01-01" })).toBe(false);
  });

  it("enforces the status machine", () => {
    expect(canTransition("draft", "awaiting_counterparty")).toBe(true);
    expect(canTransition("settled", "draft")).toBe(false);
  });
});
