import { Module } from "@nestjs/common";
import { EventsController } from "./events.controller";
import { EventsRepository } from "./events.repository";
import { EventsService } from "./events.service";

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventsRepository],
  exports: [EventsService, EventsRepository]
})
export class EventsModule {}
