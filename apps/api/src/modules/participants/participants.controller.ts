import { Controller, ForbiddenException, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { EventAccessRole, TicketStatus, UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { ParticipantsService } from "./participants.service";
import { EventAccessService } from "../events/event-access.service";

@ApiTags("Participantes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("participants")
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService, private readonly eventAccess: EventAccessService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: { page?: string; perPage?: string; search?: string; eventId?: string; status?: TicketStatus }
  ) {
    if (user.role === UserRole.ORGANIZER || user.role === UserRole.ADMIN) {
      return this.participants.list(user.tenantId!, query);
    }
    if (!query.eventId) throw new ForbiddenException("Informe um evento ao consultar participantes.");
    return this.eventAccess.assertAccess(query.eventId, user.id, [EventAccessRole.GESTOR, EventAccessRole.EDITOR, EventAccessRole.OPERACAO]).then(async () => {
      const role = await this.eventAccess.roleFor(query.eventId!, user.id);
      return role === EventAccessRole.OPERACAO
        ? this.participants.listForOperations(user.tenantId!, query)
        : this.participants.list(user.tenantId!, query);
    });
  }
}
