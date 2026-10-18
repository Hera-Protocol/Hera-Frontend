import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AlertDto } from "@hera/core";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config/config";
import { createMailTransport } from "./mail.module";
import { LogMailTransport, SmtpMailTransport } from "./mail-transport";
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
