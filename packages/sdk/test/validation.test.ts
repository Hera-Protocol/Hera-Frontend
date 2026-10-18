import { parseSubject } from "@hera/core";
import { describe, expect, it } from "vitest";
import { HeraValidationError } from "../src";
import { client, G, json, M, mockFetch, screening } from "./helpers";
import { travelRuleInput } from "./routes";

/** Every case must fail locally with the API's message and never call fetch. */
async function expectLocal422(run: (h: ReturnType<typeof client>) => Promise<unknown>) {
  const { fetch, calls } = mockFetch(json(screening()));
  const error = await run(client(fetch)).then(
    () => null,
    (e: unknown) => e,
  );
  expect(calls, "no network call").toHaveLength(0);
  expect(error).toBeInstanceOf(HeraValidationError);
  const e = error as HeraValidationError;
  expect(e.status).toBe(422);
  expect(e.code).toBe("validation_failed");
  return e;
}

describe("validation before the network", () => {
  it("rejects a G… address with a bad checksum using parseSubject's message", async () => {
    const typo = `${G.slice(0, -1)}A`;
    const expected = parseSubject({ address: typo });
    expect(expected.ok).toBe(false);
    const e = await expectLocal422((h) => h.screen(typo));
    expect(e.message).toBe("That G… address has an invalid checksum or length.");
    expect(e.fields).toEqual({ address: e.message });
  });

  it("rejects a muxed address combined with a memo", async () => {
    const e = await expectLocal422((h) => h.screen({ address: M, memo: { type: "id", value: "7" } }));
    expect(e.message).toBe("A muxed address already identifies the sub-account. Remove the memo.");
  });

  it("rejects bad memos", async () => {
    expect((await expectLocal422((h) => h.screen({ address: G, memo: { type: "id", value: "-1" } }))).message).toBe(
      "Memo ID must be an unsigned 64-bit integer.",
    );
    expect((await expectLocal422((h) => h.screen({ address: G, memo: { type: "text", value: "x".repeat(29) } }))).message).toBe(
      "Memo text is limited to 28 bytes.",
    );
  });

  it("rejects an EIP-55 checksum mismatch", async () => {
    const e = await expectLocal422((h) => h.guard("0x098b716b8Aaf21512996dC57EB0615e2383E2f96"));
    expect(e.message).toMatch(/^Checksum mismatch/);
  });

  it("rejects unknown chains and empty input with the contract's zod messages", async () => {
    expect((await expectLocal422((h) => h.screen({ address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "solana" as never }))).fields).toEqual({
      chain: "Unknown chain",
    });
    const empty = await expectLocal422((h) => h.screen("  "));
    expect(empty.message).toBe("Some fields need attention.");
    expect(empty.fields).toEqual({ address: "Enter an address" });
  });

  it("validates watch input, including the label", async () => {
    expect((await expectLocal422((h) => h.wallets.watch({ address: G, label: "" }))).fields).toEqual({ label: "Give it a label" });
    expect((await expectLocal422((h) => h.wallets.watch({ address: "nope", label: "x" }))).fields).toHaveProperty("address");
  });

  it("validates Travel Rule accounts with field paths the API uses", async () => {
    const e = await expectLocal422((h) => h.travelRule.create({ ...travelRuleInput, beneficiaryAccount: { address: "0xnope" } }));
    expect(Object.keys(e.fields!)).toEqual(["beneficiaryAccount.address"]);
    const wrongChain = await expectLocal422((h) => h.travelRule.create({ ...travelRuleInput, beneficiaryAccount: { address: G } }));
    expect(wrongChain.fields).toEqual({ "beneficiaryAccount.address": "This address isn't on evm:1." });
  });

  it("requires an originator identifier when the Travel Rule applies", async () => {
    const e = await expectLocal422((h) =>
      h.travelRule.create({ ...travelRuleInput, originator: { type: "natural", firstName: "Olu", lastName: "Originator" } }),
    );
    expect(e.fields).toHaveProperty("originator");
  });

  it("requires a disposition and note to close an alert", async () => {
    const e = await expectLocal422((h) => h.alerts.update("0b9c2c62-5f37-4c8e-9a51-3f0c7c1c0d11", { status: "closed" }));
    expect(e.fields).toEqual({ note: "Closing an alert needs a disposition and a note" });
  });

  it("validates transitions and report inputs", async () => {
    await expectLocal422((h) => h.travelRule.transition("0b9c2c62-5f37-4c8e-9a51-3f0c7c1c0d11", "teleported" as never));
    await expectLocal422((h) => h.reports.create({ type: "audit", from: "2026-10-01", to: "2026-09-01" }));
  });

  it("passes muxed and memo forms through to the API", async () => {
    const { fetch, calls } = mockFetch(json(screening()));
    const h = client(fetch);
    await h.screen(M);
    await h.screen({ address: G, memo: { type: "text", value: "invoice 42" } });
    expect(calls.map((c) => c.body)).toEqual([{ address: M }, { address: G, memo: { type: "text", value: "invoice 42" } }]);
  });
});
