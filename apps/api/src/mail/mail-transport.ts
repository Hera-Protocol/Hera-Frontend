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
