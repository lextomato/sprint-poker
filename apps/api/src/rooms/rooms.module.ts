import { Module } from "@nestjs/common";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { RetrospectivesController } from "./retrospectives.controller";
import { TeamsController } from "./teams.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [RoomsController, RetrospectivesController, TeamsController],
  providers: [RoomsService],
  exports: [RoomsService]
})
export class RoomsModule {}
