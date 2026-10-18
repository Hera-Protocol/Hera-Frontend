import { describe, expect, it } from "vitest";
import { decodeMuxedAccount, encodeMuxedAccount, isValidAccountId, isValidMuxedAccount } from "./strkey";

const G = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";

// Generated with @stellar/stellar-base 13.1.0 (MuxedAccount#accountId).
const VECTORS: [string, string][] = [
  ["0", "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ"],
  ["1234", "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAE2JUG6"],
  ["9223372036854775808", "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK"],
  ["18446744073709551615", "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJV7777777777775ZO4"],
];

describe("SEP-23 muxed accounts", () => {
  it.each(VECTORS)("decodes id %s", (id, muxed) => {
    const decoded = decodeMuxedAccount(muxed);
    expect(decoded).not.toBeNull();
    expect(decoded!.account).toBe(G);
    expect(decoded!.id).toBe(BigInt(id));
  });

  it.each(VECTORS)("encodes id %s", (id, muxed) => {
    expect(encodeMuxedAccount(G, id)).toBe(muxed);
  });

  it("rejects a corrupted checksum", () => {
    const bad = VECTORS[1]![1].slice(0, -1) + "A";
    expect(isValidMuxedAccount(bad)).toBe(false);
  });

  it("rejects a G address passed as muxed and vice versa", () => {
    expect(decodeMuxedAccount(G)).toBeNull();
    expect(isValidAccountId(VECTORS[0]![1])).toBe(false);
  });

  it("rejects ids outside uint64", () => {
    expect(() => encodeMuxedAccount(G, -1n)).toThrow();
    expect(() => encodeMuxedAccount(G, 1n << 64n)).toThrow();
  });
});

describe("G addresses", () => {
  it("validates checksums", () => {
    expect(isValidAccountId(G)).toBe(true);
    expect(isValidAccountId("GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")).toBe(true);
    expect(isValidAccountId(G.slice(0, -1) + "A")).toBe(false);
    expect(isValidAccountId(G.toLowerCase())).toBe(false);
    expect(isValidAccountId(G + "A")).toBe(false);
  });
});
