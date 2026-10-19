import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Logger } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Short template name, e.g. `verify-email`; used for log lines and file names. */
  tag: string;
}

/** A way of getting a message out the door. Swap drivers with MAIL_DRIVER. */
export interface MailTransport {
  readonly name: string;
  send(message: MailMessage, from: string): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol("MAIL_TRANSPORT");

/** Development driver: one log line per message, and the full message on disk. */
export class LogMailTransport implements MailTransport {
  readonly name = "log";
  private readonly logger = new Logger("Mail");
  private counter = 0;

  constructor(readonly directory: string) {}

  async send(message: MailMessage, from: string): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const recipient = message.to.replace(/[^a-z0-9@._-]/gi, "_");
    const base = path.join(this.directory, `${stamp}-${String(++this.counter).padStart(3, "0")}-${message.tag}-${recipient}`);
    const headers = `From: ${from}\nTo: ${message.to}\nSubject: ${message.subject}\nX-Hera-Template: ${message.tag}\n\n`;
    await Promise.all([writeFile(`${base}.html`, message.html), writeFile(`${base}.txt`, headers + message.text)]);
    this.logger.log(`${message.tag} → ${message.to}: "${message.subject}" (${path.relative(process.cwd(), base) || base}.html)`);
  }
}

/** Production driver: nodemailer over SMTP_URL (smtp:// or smtps://). */
export class SmtpMailTransport implements MailTransport {
  readonly name = "smtp";
  private readonly transporter: Transporter;

  constructor(smtpUrl: string) {
    this.transporter = createTransport(smtpUrl);
  }

  async send(message: MailMessage, from: string): Promise<void> {
    await this.transporter.sendMail({ from, to: message.to, subject: message.subject, html: message.html, text: message.text });
  }
}

/** Production driver: Resend's HTTP API (RESEND_API_KEY). MAIL_FROM must be on a domain verified in Resend. */
export class ResendMailTransport implements MailTransport {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {}

  async send(message: MailMessage, from: string): Promise<void> {
    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: [{ name: "template", value: message.tag.replace(/[^a-zA-Z0-9_-]/g, "_") }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Resend errors are JSON { name, message }; never echo the key back.
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
    }
  }
}
