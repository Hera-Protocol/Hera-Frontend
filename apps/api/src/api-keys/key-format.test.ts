import { describe, expect, it } from "vitest";
import { generateKey, hashSecret, parseKey, secretMatches } from "./key-format";

describe("API key format", () => {
  it("round-trips a generated key, including secrets that contain underscores", () => {
    for (let i = 0; i < 50; i++) {
      const { key, prefix, secret } = generateKey();
      expect(parseKey(key)).toEqual({ prefix, secret });
    }
  });

  it("rejects malformed keys", () => {
    expect(parseKey("hera_test_abcdefgh_xxxxxxxxxxxxxxxxxxxxxxxx")).toBeNull();
    expect(parseKey("hera_live_short")).toBeNull();
    expect(parseKey("hera_live_ABCDEFGH_xxxxxxxxxxxxxxxxxxxxxxxx")).toBeNull();
  });

  it("verifies only with the same pepper", () => {
    const hash = hashSecret("pepper-a", "secret");
    expect(secretMatches("pepper-a", "secret", hash)).toBe(true);
    expect(secretMatches("pepper-b", "secret", hash)).toBe(false);
    expect(secretMatches("pepper-a", "secreT", hash)).toBe(false);
  });
});
