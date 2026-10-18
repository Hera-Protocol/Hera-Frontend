import path from "node:path";
import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { LogMailTransport, MAIL_TRANSPORT, type MailTransport, SmtpMailTransport } from "./mail-transport";
import { MailerService } from "./mailer.service";

export function createMailTransport(config: AppConfig): MailTransport {
  if (config.mail.driver === "smtp") {
    if (!config.mail.smtpUrl) throw new Error("MAIL_DRIVER=smtp needs SMTP_URL (e.g. smtps://user:pass@smtp.example.com:465).");
    return new SmtpMailTransport(config.mail.smtpUrl);
  }
  return new LogMailTransport(path.join(config.dataDir, "mail"));
}

@Global()
@Module({
  providers: [{ provide: MAIL_TRANSPORT, inject: [APP_CONFIG], useFactory: createMailTransport }, MailerService],
  exports: [MailerService],
})
export class MailModule {}
