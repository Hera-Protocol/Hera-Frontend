import { Inject, Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { MAIL_TRANSPORT, type MailTransport } from "./mail-transport";
import type { RenderedEmail } from "./templates";

/**
 * Sends rendered templates through whichever transport MAIL_DRIVER picked.
 * Delivery problems are logged, never thrown: a flaky SMTP server must not
 * fail a signup or roll back an alert.
 */
@Injectable()
export class MailerService implements OnApplicationShutdown {
  private readonly logger = new Logger("Mail");
  private readonly pending = new Set<Promise<boolean>>();

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async send(to: string, email: RenderedEmail): Promise<boolean> {
    try {
      await this.transport.send({ to, ...email }, this.config.mail.from);
      return true;
    } catch (error) {
      this.logger.error(`Couldn't send ${email.tag} to ${to}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /** Fire and forget, for post-commit notifications. */
  sendLater(to: string, email: RenderedEmail): void {
    const sending = this.send(to, email).finally(() => this.pending.delete(sending));
    this.pending.add(sending);
  }

  /** Wait for every fire-and-forget send. Tests and shutdown use it. */
  async flush(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.flush();
  }

  /** Links into the web app. */
  link(pathname: string, params: Record<string, string> = {}): string {
    const url = new URL(pathname, `${this.config.webOrigin}/`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }
}
