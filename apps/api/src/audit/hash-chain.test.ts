import { describe, expect, it } from "vitest";
import { auditHash, canonicalJson, GENESIS_HASH } from "./hash-chain";

describe("canonicalJson", () => {
  it("sorts keys at every depth and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[1,{"y":2,"z":1}]},"b":1}');
  });

  it("is insensitive to key order", () => {
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });
});

describe("auditHash", () => {
  const fields = { seq: 1, actor: "a@example.com", action: "user.signup", target: null, metadata: {}, createdAt: "2026-01-01T00:00:00.000Z" };

  it("chains on the previous hash", () => {
    const first = auditHash(GENESIS_HASH, fields);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(auditHash(first, { ...fields, seq: 2 })).not.toBe(auditHash(GENESIS_HASH, { ...fields, seq: 2 }));
  });

  it("changes when any field changes", () => {
    expect(auditHash(GENESIS_HASH, { ...fields, metadata: { x: 1 } })).not.toBe(auditHash(GENESIS_HASH, fields));
  });
});
