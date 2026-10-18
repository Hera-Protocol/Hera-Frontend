import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { loadConfig } from "./config/config";

async function bootstrap(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }
  const config = loadConfig();
  const logger = new Logger("Bootstrap");

  if (config.apiKeyPepperIsDefault && config.env === "production") {
    logger.warn("!!! API_KEY_PEPPER is not set. API key secrets are hashed with a public development key. Set it before issuing real keys. !!!");
  }
  if (config.webhooks.secretKeyIsDefault && config.env === "production") {
    logger.warn("!!! WEBHOOK_SECRET_KEY is not set. Webhook signing secrets are encrypted with a public development key. Set it (openssl rand -base64 32) before adding endpoints. !!!");
  }

  const app = await NestFactory.create(AppModule.register(config), { bodyParser: false });
  configureApp(app, config);
  app.enableShutdownHooks();
  // Interactive screens are capped at SCREEN_DEADLINE_MS (8 s) and evidence PDFs render in well under that;
  // keep Node's socket limits comfortably above both so slow upstreams surface as 502s, not resets.
  const server = app.getHttpServer() as import("node:http").Server;
  server.requestTimeout = 120_000;
  server.headersTimeout = 60_000;
  server.keepAliveTimeout = 65_000;
  await app.listen(config.port);
  logger.log(`Hera API listening on http://localhost:${config.port}/v1`);
}

void bootstrap();
