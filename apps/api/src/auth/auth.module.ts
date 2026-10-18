import { Module } from "@nestjs/common";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthController, MeController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { SessionsService } from "./sessions.service";

@Module({
  imports: [ApiKeysModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, PasswordService, SessionsService, AuthGuard],
  exports: [AuthGuard, SessionsService, AuthService, PasswordService],
})
export class AuthModule {}
