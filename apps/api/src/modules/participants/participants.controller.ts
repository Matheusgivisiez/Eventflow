import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { TicketStatus } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { ParticipantsService } from "./participants.service";

@ApiTags("Participantes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("participants")
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: { page?: string; perPage?: string; search?: string; eventId?: string; status?: TicketStatus }
  ) {
    return this.participants.list(user.tenantId!, query);
  }
}
