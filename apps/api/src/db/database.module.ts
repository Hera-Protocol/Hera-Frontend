import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { DATABASE, type DatabaseHandle, openDatabase } from "./database";

const DATABASE_HANDLE = Symbol("DATABASE_HANDLE");

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_HANDLE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => openDatabase(config),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_HANDLE],
      useFactory: (handle: DatabaseHandle) => handle.db,
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_HANDLE) private readonly handle: DatabaseHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.close();
  }
}
