import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { postRaw } from "./http-post";
import { generateWebhookSecret, openSecret, sealSecret, secretPrefixOf } from "./secret-box";
import { isBlockedAddress } from "./ssrf";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "169.254.0.1",
    "0.0.0.0",
    "100.64.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456:789a::1",
    "fe80::1",
    "febf::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "64:ff9b::10.0.0.1",
    "[::1]",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "192.169.0.1", "169.253.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8", "fec0::1"])(
    "allows %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );
});

describe("postRaw with the production guard", () => {
  it("refuses loopback literals and hostnames that resolve to them, and allows them without the guard", async () => {
    const server = createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      const literal = await postRaw(`http://127.0.0.1:${port}/`, "{}", {}, { timeoutMs: 2000, guard: true });
      expect(literal).toMatchObject({ ok: false, error: expect.stringMatching(/Refusing to deliver/) });
      const named = await postRaw(`http://localhost:${port}/`, "{}", {}, { timeoutMs: 2000, guard: true });
      expect(named).toMatchObject({ ok: false, error: expect.stringMatching(/Refusing to deliver/) });
      const metadata = await postRaw("http://169.254.169.254/latest/meta-data", "{}", {}, { timeoutMs: 2000, guard: true });
      expect(metadata.ok).toBe(false);

      expect(await postRaw(`http://127.0.0.1:${port}/`, "{}", {}, { timeoutMs: 2000, guard: false })).toEqual({ ok: true, status: 200 });
    } finally {
      server.close();
    }
  });

  it("treats redirects as failures and times out slow receivers", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/slow") return; // never answers
      res.writeHead(302, { location: "http://169.254.169.254/" }).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      expect(await postRaw(`http://127.0.0.1:${port}/`, "{}", {}, { timeoutMs: 2000, guard: false })).toMatchObject({ ok: false, status: 302, error: expect.stringMatching(/not followed/) });
      expect(await postRaw(`http://127.0.0.1:${port}/slow`, "{}", {}, { timeoutMs: 200, guard: false })).toEqual({ ok: false, error: "Timed out after 0.2s" });
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});

describe("secret box", () => {
  const key = Buffer.alloc(32, 7);

  it("round-trips and binds the ciphertext to its endpoint", () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    expect(secretPrefixOf(secret)).toHaveLength(12);
    const sealed = sealSecret(key, secret, "endpoint-a");
    expect(sealed).not.toContain(secret.slice(6));
    expect(openSecret(key, sealed, "endpoint-a")).toBe(secret);
    expect(() => openSecret(key, sealed, "endpoint-b")).toThrow();
    expect(() => openSecret(Buffer.alloc(32, 8), sealed, "endpoint-a")).toThrow();
    expect(sealSecret(key, secret, "endpoint-a")).not.toBe(sealed); // fresh IV each time
  });
});
