import { Module } from "@nestjs/common";
import { ParticipantsController } from "./participants.controller";
import { ParticipantsService } from "./participants.service";

@Module({
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
  exports: [ParticipantsService]
})
export class ParticipantsModule {}
