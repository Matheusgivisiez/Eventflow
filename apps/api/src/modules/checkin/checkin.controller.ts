import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { CheckInService } from "./checkin.service";
import { ValidateTicketDto } from "./dto/validate-ticket.dto";

import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { TeamPermissionGuard } from "../../common/guards/team-permission.guard";
import { TeamPermission } from "@prisma/client";

@ApiTags("Check-in")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TeamPermissionGuard)
@Controller("check-in")
export class CheckInController {
  constructor(private readonly checkIn: CheckInService) {}

  @Post("events/:eventId/validate")
  @ApiOperation({ summary: "Validar ingresso", description: "Valida um ingresso na entrada do evento." })
  @RequirePermissions(TeamPermission.CHECK_IN)
  validate(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() dto: ValidateTicketDto) {
    return this.checkIn.validate(eventId, user.tenantId!, user.id, dto.code);
  }

  @Get("events/:eventId/logs")
  @ApiOperation({ summary: "Listar logs de check-in", description: "Retorna o histórico de validações do evento." })
  @RequirePermissions(TeamPermission.CHECK_IN)
  logs(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string) {
    return this.checkIn.list(eventId, user.tenantId!);
  }
}
