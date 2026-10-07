import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { TicketOrigin } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { EventAccessService } from "../events/event-access.service";
import { CourtesyService } from "./courtesy.service";
import { IssueCourtesyDto } from "./dto/issue-courtesy.dto";

/**
 * Cortesias do organizador. Somente quem criou o evento emite, lista e
 * cancela: ingresso sem cobrança não é delegado à equipe. A origem é fixa em
 * ORGANIZER_COURTESY, então nada daqui alcança os convidados da plataforma.
 */
@ApiTags("Cortesias")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("events/:eventId/courtesy")
export class EventCourtesyController {
  constructor(private readonly courtesy: CourtesyService, private readonly access: EventAccessService) {}

  @Get()
  @ApiOperation({ summary: "Listar cortesias emitidas pelo dono do evento" })
  async list(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string) {
    await this.access.assertOwner(eventId, user.id);
    return this.courtesy.list(eventId, TicketOrigin.ORGANIZER_COURTESY);
  }

  @Post()
  @Throttle({ sensitive: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Emitir cortesias do evento" })
  async issue(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() dto: IssueCourtesyDto) {
    await this.access.assertOwner(eventId, user.id);
    return this.courtesy.issue(eventId, TicketOrigin.ORGANIZER_COURTESY, user, dto);
  }

  @Post(":ticketId/cancel")
  @ApiOperation({ summary: "Cancelar uma cortesia ainda não utilizada" })
  async cancel(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Param("ticketId") ticketId: string) {
    await this.access.assertOwner(eventId, user.id);
    return this.courtesy.cancel(ticketId, TicketOrigin.ORGANIZER_COURTESY, user, eventId);
  }
}
