import { describe, expect, it } from "vitest";
import { parseSubject, subjectKey } from "./subject";

describe("parseSubject", () => {
  it("decodes a muxed address into account + id at the edge", () => {
    const result = parseSubject({ address: "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK" });
    expect(result).toEqual({
      ok: true,
      subject: {
        chain: "stellar",
        account: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        sub: { kind: "muxed", id: "42", muxed: "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK" },
      },
    });
  });

  it("keeps memo as a sub-account and validates it", () => {
    const ok = parseSubject({ address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", memo: { type: "id", value: "1001" } });
    expect(ok.ok && ok.subject.chain === "stellar" && ok.subject.sub).toEqual({ kind: "memo", type: "id", value: "1001" });
    const bad = parseSubject({ address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", memo: { type: "id", value: "abc" } });
    expect(bad.ok).toBe(false);
  });

  it("rejects memo + muxed together", () => {
    const r = parseSubject({ address: "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK", memo: { type: "id", value: "1" } });
    expect(r.ok).toBe(false);
  });

  it("checksums EVM input and defaults to Ethereum", () => {
    const r = parseSubject({ address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" });
    expect(r).toEqual({ ok: true, subject: { chain: "evm:1", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" } });
  });

  it("builds distinct keys for base and sub-accounts", () => {
    const base = parseSubject({ address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" });
    const mux = parseSubject({ address: "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK" });
    if (!base.ok || !mux.ok) throw new Error("parse failed");
    expect(subjectKey(base.subject)).not.toBe(subjectKey(mux.subject));
  });
});
