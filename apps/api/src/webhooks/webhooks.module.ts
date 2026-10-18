import { Global, Module } from "@nestjs/common";
import { WebhookDispatcher } from "./dispatcher.service";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

/** Global so any module can `emit` into the outbox inside its own transaction. */
@Global()
@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDispatcher],
  exports: [WebhooksService, WebhookDispatcher],
})
export class WebhooksModule {}
