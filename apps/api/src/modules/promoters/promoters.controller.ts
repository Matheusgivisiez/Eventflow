import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PromoterStatus, UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequestUser } from "../../common/types/request-user";
import { PromotersService } from "./promoters.service";

@ApiTags("Promoters")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("promoters")
export class PromotersController {
  constructor(private readonly promoters: PromotersService) {}

  // ──────────────────────────────────────────────
  // Promoter Management (Organizer / Admin)
  // ──────────────────────────────────────────────

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Lista todos os promoters do tenant" })
  list(@CurrentUser() user: RequestUser) {
    return this.promoters.list(user.tenantId!);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Cria um novo promoter" })
  create(@CurrentUser() user: RequestUser, @Body() body: any) {
    return this.promoters.create(user.tenantId!, body);
  }

  @Patch(":id/status")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Atualiza o status de um promoter" })
  updateStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body("status") status: PromoterStatus) {
    return this.promoters.updateStatus(user.tenantId!, id, status);
  }

  @Get(":id/performance")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Retorna o desempenho detalhado de um promoter" })
  getPerformance(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.promoters.getPerformance(user.tenantId!, id);
  }

  // ──────────────────────────────────────────────
  // Promoter Links by Event
  // ──────────────────────────────────────────────

  @Get("events/:eventId/links")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Lista os links de promoters de um evento" })
  listEventLinks(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string) {
    return this.promoters.listEventLinks(user.tenantId!, eventId);
  }

  @Post("events/:eventId/links")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Vincula um promoter a um evento" })
  addPromoterToEvent(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() body: any) {
    return this.promoters.addPromoterToEvent(user.tenantId!, eventId, body);
  }

  @Patch("events/:eventId/links/:linkId")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Atualiza a comissão ou status de um link de promoter" })
  updatePromoterLink(
    @CurrentUser() user: RequestUser,
    @Param("eventId") eventId: string,
    @Param("linkId") linkId: string,
    @Body() body: { commissionType?: string; commissionValue?: number; isActive?: boolean }
  ) {
    return this.promoters.updatePromoterLink(user.tenantId!, eventId, linkId, body);
  }

  @Delete("events/:eventId/links/:linkId")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Remove um promoter de um evento" })
  removePromoterFromEvent(
    @CurrentUser() user: RequestUser,
    @Param("eventId") eventId: string,
    @Param("linkId") linkId: string
  ) {
    return this.promoters.removePromoterFromEvent(user.tenantId!, eventId, linkId);
  }

  @Get("events/:eventId/ranking")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Ranking de promoters por evento" })
  getEventRanking(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string) {
    return this.promoters.getEventRanking(user.tenantId!, eventId);
  }

  // ──────────────────────────────────────────────
  // Public click tracking (no auth required)
  // Handled separately to avoid auth guard
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Withdrawals
  // ──────────────────────────────────────────────

  @Get("withdrawals")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiOperation({ summary: "Lista solicitações de saque dos promoters" })
  withdrawals(@CurrentUser() user: RequestUser) {
    return this.promoters.withdrawals(user.tenantId!);
  }
}
