import { describe, expect, it } from "vitest";
import { HeraBlockedError } from "../src";
import { client, EVM_SANCTIONED, json, M, mockFetch, screening } from "./helpers";

const guardWith = (decision: "allow" | "review" | "block") => client(mockFetch(json(screening(decision))).fetch);

describe("guard", () => {
  it("allows an allow decision and returns only contributing reasons, highest first", async () => {
    const result = await guardWith("allow").guard(M);
    expect(result).toMatchObject({ allowed: true, decision: "allow", needsReview: false, score: 8, band: "low" });
    expect(result.reasons.map((r) => r.code)).toEqual(["FRESH_ACCOUNT"]);
    expect(result.screening.reasons).toHaveLength(2);
  });

  it("throws HeraBlockedError carrying the screening on block", async () => {
    const error = await guardWith("block").guard(EVM_SANCTIONED).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HeraBlockedError);
    const blocked = error as HeraBlockedError;
    expect(blocked.decision).toBe("block");
    expect(blocked.screening.score).toBe(100);
    expect(blocked.code).toBe("blocked");
    expect(blocked.message).toContain("Sanctioned address");
  });

  it("lets review through by default, flagged for a human", async () => {
    const result = await guardWith("review").guard(M);
    expect(result).toMatchObject({ allowed: true, decision: "review", needsReview: true });
  });

  it("review: 'throw' blocks review decisions", async () => {
    await expect(guardWith("review").guard(M, { review: "throw" })).rejects.toBeInstanceOf(HeraBlockedError);
  });

  it("a custom block list takes precedence over review: 'allow'", async () => {
    await expect(guardWith("review").guard(M, { block: ["block", "review"], review: "allow" })).rejects.toMatchObject({ decision: "review" });
  });

  it("an empty block list never throws", async () => {
    const result = await guardWith("block").guard(EVM_SANCTIONED, { block: [] });
    expect(result.allowed).toBe(true);
  });

  it("throwOnBlock: false returns allowed: false instead of throwing", async () => {
    const result = await guardWith("block").guard(EVM_SANCTIONED, { throwOnBlock: false });
    expect(result).toMatchObject({ allowed: false, decision: "block", needsReview: false });
  });

  it("forwards request options to the screen call", async () => {
    const { fetch, calls } = mockFetch(json(screening()));
    const controller = new AbortController();
    await client(fetch).guard({ address: M }, { signal: controller.signal, block: ["block"] });
    expect(calls[0]!.body).toEqual({ address: M });
  });
});
