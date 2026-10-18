import { describe, expect, it } from "vitest";
import { checkEvmAddress, toChecksumAddress } from "./address";

describe("EIP-55", () => {
  it("checksums known addresses", () => {
    expect(toChecksumAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    // Vectors from the EIP-55 spec.
    expect(toChecksumAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed")).toBe("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
    expect(toChecksumAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359")).toBe("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359");
  });

  it("accepts lowercase and correct mixed case, rejects a bad checksum", () => {
    expect(checkEvmAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045").ok).toBe(true);
    expect(checkEvmAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045").ok).toBe(true);
    expect(checkEvmAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96046")).toEqual({ ok: false, reason: "checksum" });
    expect(checkEvmAddress("0x1234")).toEqual({ ok: false, reason: "format" });
  });
});
