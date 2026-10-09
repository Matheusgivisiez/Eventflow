import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { TicketsModule } from "../tickets/tickets.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [EventsModule, TicketsModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
