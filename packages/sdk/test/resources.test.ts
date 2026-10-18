import { describe, expect, it } from "vitest";
import { BASE, client, json, mockFetch } from "./helpers";
import { ROUTES } from "./routes";

describe("every resource method hits the right method and path", () => {
  for (const route of ROUTES) {
    it(`${route.name} → ${route.method} ${route.path}`, async () => {
      const { fetch, calls } = mockFetch(route.response ? () => route.response!() : json({}));
      await route.call(client(fetch));
      expect(calls).toHaveLength(1);
      expect(calls[0]!.method).toBe(route.method);
      expect(calls[0]!.url).toBe(`${BASE}${route.path}`);
      if (route.body !== undefined) expect(calls[0]!.body).toEqual(route.body);
      else expect(calls[0]!.body).toBeUndefined();
    });
  }
});

describe("response handling", () => {
  it("returns undefined for 204", async () => {
    const { fetch } = mockFetch(new Response(null, { status: 204 }));
    await expect(client(fetch).wallets.unwatch("0b9c2c62-5f37-4c8e-9a51-3f0c7c1c0d11")).resolves.toBeUndefined();
  });

  it("downloads reports as bytes and asks for a PDF", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\n...");
    const { fetch, calls } = mockFetch(new Response(bytes, { headers: { "content-type": "application/pdf" } }));
    const pdf = await client(fetch).reports.download("0b9c2c62-5f37-4c8e-9a51-3f0c7c1c0d11");
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(pdf.slice(0, 4))).toBe("%PDF");
    expect(calls[0]!.headers.accept).toBe("application/pdf");
  });

  it("encodes nothing unsafe into paths: ids must be uuids", async () => {
    const { fetch, calls } = mockFetch(json({}));
    await expect(client(fetch).alerts.get("../keys")).rejects.toMatchObject({ name: "HeraValidationError" });
    await expect(client(fetch).reports.get("abc")).rejects.toThrow(/not a valid report id/);
    expect(calls).toHaveLength(0);
  });

  it("omits undefined query params", async () => {
    const { fetch, calls } = mockFetch(json([]));
    await client(fetch).alerts.list();
    await client(fetch).screenings.list();
    expect(calls.map((c) => c.url)).toEqual([`${BASE}/alerts`, `${BASE}/screenings`]);
  });
});
