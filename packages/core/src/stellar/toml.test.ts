import { describe, expect, it } from "vitest";
import { parseStellarToml, tomlListsAccount } from "./toml";

const TOML = `
# Example anchor
VERSION = "2.0.0"
ACCOUNTS = [
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", # hot wallet
  "GBBBB"
]
SIGNING_KEY = "GSIGN"
WEB_AUTH_ENDPOINT = "https://anchor.example/auth"
KYC_SERVER = "https://anchor.example/kyc"
DIRECT_PAYMENT_SERVER = "https://anchor.example/sep31"

[DOCUMENTATION]
ORG_NAME = "Example Anchor #1"

[[CURRENCIES]]
code = "USDX"
issuer = "GISSUER"
`;

describe("parseStellarToml", () => {
  it("reads accounts, issuers, endpoints and org name", () => {
    const toml = parseStellarToml(TOML);
    expect(toml.accounts).toEqual(["GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "GBBBB"]);
    expect(toml.currencyIssuers).toEqual(["GISSUER"]);
    expect(toml.orgName).toBe("Example Anchor #1");
    expect(Object.keys(toml.endpoints)).toEqual(["WEB_AUTH_ENDPOINT", "KYC_SERVER", "DIRECT_PAYMENT_SERVER"]);
    expect(tomlListsAccount(toml, "GISSUER")).toBe(true);
    expect(tomlListsAccount(toml, "GSIGN")).toBe(true);
    expect(tomlListsAccount(toml, "GNOPE")).toBe(false);
  });
});
