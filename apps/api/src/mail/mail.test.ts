import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AlertDto } from "@hera/core";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config/config";
import { createMailTransport } from "./mail.module";
import { LogMailTransport, ResendMailTransport, SmtpMailTransport } from "./mail-transport";
import { alertNotification, escapeHtml, passwordReset, reportReady, teamInvite, verifyEmail } from "./templates";

const dir = mkdtempSync(path.join(os.tmpdir(), "hera-mail-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("log mail driver", () => {
  it("writes the html and text of every message", async () => {
    const transport = new LogMailTransport(dir);
    await transport.send({ to: "ada@example.com", ...verifyEmail({ name: "Ada", url: "http://localhost:3000/verify-email?token=abc" }) }, "Hera <no-reply@heralayer.com>");
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(2);
    expect(files[0]).toMatch(/verify-email-ada@example\.com\.html$/);
    const text = readFileSync(path.join(dir, files[1]!), "utf8");
    expect(text).toContain("To: ada@example.com");
    expect(text).toContain("From: Hera <no-reply@heralayer.com>");
    expect(text).toContain("http://localhost:3000/verify-email?token=abc");
    expect(readFileSync(path.join(dir, files[0]!), "utf8")).toContain("<table");
  });

  it("is chosen by MAIL_DRIVER, with smtp the production default", () => {
    expect(createMailTransport(loadConfig({ NODE_ENV: "development" }))).toBeInstanceOf(LogMailTransport);
    expect(createMailTransport(loadConfig({ NODE_ENV: "production", SMTP_URL: "smtp://localhost:2525" }))).toBeInstanceOf(SmtpMailTransport);
    expect(() => createMailTransport(loadConfig({ NODE_ENV: "production" }))).toThrow(/SMTP_URL/);
    expect(createMailTransport(loadConfig({ NODE_ENV: "production", MAIL_DRIVER: "log" }))).toBeInstanceOf(LogMailTransport);
    expect(loadConfig({}).mail.from).toBe("Hera <no-reply@heralayer.com>");
  });
});

describe("templates", () => {
  const alert = { id: "a", chain: "evm:1", subjectDisplay: "0xabc", reasonCode: "SANCTIONS_DIRECT", title: "Sanctioned <address>", detail: "", severity: "critical", status: "open", score: 100, notes: [], createdAt: "", updatedAt: "" } as AlertDto;
  const all = [
    verifyEmail({ name: "Ada", url: "https://app/v?token=1" }),
    passwordReset({ url: "https://app/r?token=1" }),
    teamInvite({ inviter: "Olive", orgName: "Acme & Co", role: "analyst", url: "https://app/i?token=1" }),
    alertNotification({ orgName: "Acme", alerts: [alert], url: "https://app/alerts" }),
    reportReady({ name: "Ada", report: { id: "r", reference: "RPT-2026Q3-7KX2", type: "audit", title: "Audit", status: "ready", requestedBy: "Ada", createdAt: "" }, url: "https://app/r" }),
  ];

  it("are table-based, paper-and-ink, image-free, with a text twin", () => {
    for (const email of all) {
      expect(email.html).toContain("#FFF5E8");
      expect(email.html).toContain("border:2px solid #17130F");
      expect(email.html).not.toMatch(/<img|<svg|<style/i);
      expect(email.text.length).toBeGreaterThan(20);
      expect(email.subject.length).toBeGreaterThan(5);
    }
  });

  it("escapes user content", () => {
    expect(all[2]!.html).toContain("Acme &amp; Co");
    expect(all[3]!.html).toContain("Sanctioned &lt;address&gt;");
    expect(all[3]!.subject).toBe("[CRITICAL] Sanctioned <address>: 0xabc");
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;");
  });
});

describe("ResendMailTransport", () => {
  it("posts the message to Resend with the key as a bearer token", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "re_123" }), { status: 200 });
    }) as unknown as typeof fetch;
    const transport = new ResendMailTransport("re_test_key", fake);
    await transport.send({ to: "ada@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", tag: "verify-email" }, "Hera <no-reply@heralayer.com>");
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ from: "Hera <no-reply@heralayer.com>", to: ["ada@example.com"], subject: "Hi", text: "Hi" });
  });

  it("throws with Resend's error message, without the key", async () => {
    const fake = (async () => new Response(JSON.stringify({ name: "validation_error", message: "Domain not verified" }), { status: 403 })) as unknown as typeof fetch;
    const transport = new ResendMailTransport("re_secret_key", fake);
    const error = await transport.send({ to: "a@b.co", subject: "s", html: "h", text: "t", tag: "x" }, "f@heralayer.com").catch((e: Error) => e);
    expect(String(error)).toMatch(/403.*Domain not verified/);
    expect(String(error)).not.toContain("re_secret_key");
  });

  it("is chosen by MAIL_DRIVER=resend and requires a key", () => {
    expect(createMailTransport(loadConfig({ MAIL_DRIVER: "resend", RESEND_API_KEY: "re_x" })).name).toBe("resend");
    expect(() => createMailTransport(loadConfig({ MAIL_DRIVER: "resend" }))).toThrow(/RESEND_API_KEY/);
  });
});

describe("chain endpoint config", () => {
  it("defaults to two Horizon instances and the free Blockscout instance", () => {
    const config = loadConfig({});
    expect(config.horizonUrls).toEqual(["https://horizon.stellar.org", "https://horizon.stellar.lobstr.co"]);
    expect(config.blockscoutUrls["evm:1"]).toEqual(["https://eth.blockscout.com/api/v2"]);
  });

  it("reads HORIZON_URLS and appends the keyed Blockscout PRO API", () => {
    const config = loadConfig({ HORIZON_URLS: "https://h1.example/, https://h2.example", BLOCKSCOUT_API_KEY: "proj_abc" });
    expect(config.horizonUrls).toEqual(["https://h1.example", "https://h2.example"]);
    expect(config.horizonUrl).toBe("https://h1.example");
    expect(config.blockscoutUrls["evm:1"]).toEqual(["https://eth.blockscout.com/api/v2", "https://api.blockscout.com/1/api/v2?apikey=proj_abc"]);
  });
});
