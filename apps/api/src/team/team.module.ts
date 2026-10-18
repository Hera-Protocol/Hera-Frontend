import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InvitesService } from "./invites.service";
import { MembersService } from "./members.service";
import { InvitesController, MembersController } from "./team.controller";

@Module({
  imports: [AuthModule],
  controllers: [InvitesController, MembersController],
  providers: [InvitesService, MembersService],
})
export class TeamModule {}
