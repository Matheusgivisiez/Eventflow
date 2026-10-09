import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { TicketOrigin, UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequestUser } from "../../common/types/request-user";
import { CourtesyService } from "./courtesy.service";
import { FindVipRecipientDto, IssueCourtesyDto } from "./dto/issue-courtesy.dto";

/**
 * Convidados da Eventflow. Só o admin da plataforma chega aqui, e ele emite
 * em qualquer evento, de qualquer organizador.
 */
@ApiTags("Administração")
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin/courtesy")
export class AdminCourtesyController {
  constructor(private readonly courtesy: CourtesyService) {}

  @Get("summary")
  @ApiOperation({ summary: "Ingressos especiais por evento (VIP da plataforma e cortesias dos organizadores)" })
  summary() {
    return this.courtesy.countsByEvent();
  }

  @Post("recipient")
  @Throttle({ sensitive: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Buscar conta existente para emissão de VIP" })
  recipient(@Body() dto: FindVipRecipientDto) {
    return this.courtesy.findVipRecipient(dto.email);
  }

  @Get("events/:eventId")
  @ApiOperation({ summary: "Listar ingressos especiais de um evento" })
  list(@Param("eventId") eventId: string, @Query("origin") origin?: string) {
    // O admin também pode auditar as cortesias que o organizador emitiu.
    return this.courtesy.list(
      eventId,
      origin === TicketOrigin.ORGANIZER_COURTESY ? TicketOrigin.ORGANIZER_COURTESY : TicketOrigin.PLATFORM_COURTESY
    );
  }

  @Post("events/:eventId")
  @Throttle({ sensitive: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Emitir ingressos VIP da plataforma para convidados" })
  issue(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() dto: IssueCourtesyDto) {
    return this.courtesy.issue(eventId, TicketOrigin.PLATFORM_COURTESY, user, dto);
  }

  @Post("tickets/:ticketId/cancel")
  @ApiOperation({ summary: "Cancelar um ingresso VIP ainda não utilizado" })
  cancel(@CurrentUser() user: RequestUser, @Param("ticketId") ticketId: string) {
    return this.courtesy.cancel(ticketId, TicketOrigin.PLATFORM_COURTESY, user);
  }
}
