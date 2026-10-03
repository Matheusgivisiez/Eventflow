import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { CreateTicketTypeDto } from "./dto/create-ticket-type.dto";
import { UpdateTicketTypeDto } from "./dto/update-ticket-type.dto";
import { TicketsService } from "./tickets.service";
import { EventAccessRole } from "@prisma/client";
import { EventAccessService } from "../events/event-access.service";

@ApiTags("Tipos de ingresso")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("events/:eventId/ticket-types")
export class TicketsController {
  constructor(private readonly tickets: TicketsService, private readonly access: EventAccessService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string) {
    return this.access.assertAccess(eventId, user.id, [EventAccessRole.GESTOR, EventAccessRole.EDITOR])
      .then(() => this.tickets.list(eventId, user.tenantId!));
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() dto: CreateTicketTypeDto) {
    return this.access.assertAccess(eventId, user.id, [EventAccessRole.GESTOR, EventAccessRole.EDITOR])
      .then(() => this.tickets.create(eventId, user.tenantId!, dto));
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTicketTypeDto) {
    return this.access.assertTicketTypeAccess(id, user.id, [EventAccessRole.GESTOR, EventAccessRole.EDITOR])
      .then(() => this.tickets.update(id, user.tenantId!, dto));
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.access.assertTicketTypeAccess(id, user.id, [EventAccessRole.GESTOR, EventAccessRole.EDITOR])
      .then(() => this.tickets.remove(id, user.tenantId!));
  }
}
