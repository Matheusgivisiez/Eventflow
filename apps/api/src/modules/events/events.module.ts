import { Module } from "@nestjs/common";
import { EventsController } from "./events.controller";
import { EventsRepository } from "./events.repository";
import { EventsService } from "./events.service";
import { EventAccessService } from "./event-access.service";

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventsRepository, EventAccessService],
  exports: [EventsService, EventsRepository, EventAccessService]
})
export class EventsModule {}
