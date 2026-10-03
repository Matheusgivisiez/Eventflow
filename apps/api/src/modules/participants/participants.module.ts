import { Module } from "@nestjs/common";
import { ParticipantsController } from "./participants.controller";
import { ParticipantsService } from "./participants.service";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [EventsModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
  exports: [ParticipantsService]
})
export class ParticipantsModule {}
