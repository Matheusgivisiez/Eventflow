import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { EventAccessRole, EventStatus, UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { EventsService } from "./events.service";
import { EventAccessService } from "./event-access.service";
import { ManageEventAccessDto } from "./dto/manage-event-access.dto";

@ApiTags("Eventos")
@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService, private readonly access: EventAccessService) {}

  @Get("public")
  @Throttle({ default: { limit: 1200, ttl: 60000 } })
  @ApiOperation({ summary: "Listar eventos públicos", description: "Retorna eventos publicados para a vitrine." })
  publicList(@Query() query: { page?: string; perPage?: string; search?: string; category?: string }) {
    return this.events.publicList(query);
  }

  @Get("public/:slug")
  @Throttle({ default: { limit: 1200, ttl: 60000 } })
  @ApiOperation({ summary: "Buscar evento por slug", description: "Retorna os detalhes públicos de um evento." })
  publicBySlug(@Param("slug") slug: string, @Query("invite") invite?: string) {
    if (invite) return this.events.publicByInvite(slug, invite);
    return this.events.publicBySlug(slug);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Listar eventos do organizador", description: "Retorna eventos paginados do tenant autenticado." })
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: { page?: string; perPage?: string; search?: string; status?: EventStatus; summary?: string }
  ) {
    return this.events.list(user.tenantId!, query, { userId: user.id, role: user.role });
  }

  @Post()
  @Throttle({ sensitive: { limit: 20, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Criar evento", description: "Cria um novo evento para o tenant autenticado." })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEventDto) {
    return this.events.create(user.tenantId!, user.id, dto);
  }

  @Get(":id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Buscar evento por ID", description: "Retorna os detalhes de um evento pelo ID." })
  @UseGuards(JwtAuthGuard)
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.access.assertAccess(id, user.id, [EventAccessRole.GESTOR, EventAccessRole.EDITOR, EventAccessRole.OPERACAO]).then(async () => {
      const role = await this.access.roleFor(id, user.id);
      const event = await this.events.findOne(id, user.tenantId!);
      if (role === EventAccessRole.OPERACAO) {
        return { ...event, accessRole: role, onlineUrl: null, ticketTypes: [] };
      }
      return { ...event, accessRole: role };
    });
  }

  @Patch(":id")
  @Throttle({ sensitive: { limit: 20, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Atualizar evento", description: "Atualiza os dados de um evento existente." })
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateEventDto) {
    return this.access.assertAccess(id, user.id, [EventAccessRole.GESTOR, EventAccessRole.EDITOR]).then(async () => {
      const role = await this.access.roleFor(id, user.id);
      if (role === EventAccessRole.EDITOR && (dto.status !== undefined || dto.isPrivate !== undefined)) {
        const current = await this.events.findOne(id, user.tenantId!);
        if ((dto.status !== undefined && dto.status !== current.status) || (dto.isPrivate !== undefined && dto.isPrivate !== current.isPrivate)) {
          throw new ForbiddenException("Somente o criador ou gestor pode alterar publicação e privacidade.");
        }
      }
      if (role !== "OWNER" && (dto.feeAbsorbedByOrganizer !== undefined || dto.allowTicketRefund !== undefined || dto.ticketRefundLockHours !== undefined)) {
        const current = await this.events.findOne(id, user.tenantId!);
        const changesFinancePolicy =
          (dto.feeAbsorbedByOrganizer !== undefined && dto.feeAbsorbedByOrganizer !== current.feeAbsorbedByOrganizer) ||
          (dto.allowTicketRefund !== undefined && dto.allowTicketRefund !== current.allowTicketRefund) ||
          (dto.ticketRefundLockHours !== undefined && dto.ticketRefundLockHours !== current.ticketRefundLockHours);
        if (changesFinancePolicy) throw new ForbiddenException("Somente o criador pode alterar taxas e política de reembolso.");
      }
      return this.events.update(id, user.tenantId!, dto);
    });
  }

  @Delete(":id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Remover evento", description: "Remove um evento pelo ID." })
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.access.assertOwner(id, user.id).then(() => this.events.remove(id, user.tenantId!));
  }

  @Post(":id/duplicate")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Duplicar evento", description: "Cria um rascunho baseado em um evento existente." })
  @UseGuards(JwtAuthGuard)
  duplicate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.access.assertOwner(id, user.id).then(() => this.events.duplicate(id, user.tenantId!, user.id));
  }

  @Patch(":id/cancel")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Cancelar evento", description: "Encerra (cancela) um evento publicado." })
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.access.assertOwner(id, user.id).then(() => this.events.cancel(id, user.tenantId!));
  }

  @Post(":id/invite-link")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Gerar ou renovar link de convite do evento privado" })
  @UseGuards(JwtAuthGuard)
  createInviteLink(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.access.assertOwner(id, user.id).then(() => this.events.createInviteLink(id, user.tenantId!));
  }

  @Get(":id/access")
  @UseGuards(JwtAuthGuard)
  listAccess(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.access.list(id, user.id, user.tenantId!);
  }

  @Post(":id/access")
  @UseGuards(JwtAuthGuard)
  addAccess(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ManageEventAccessDto) {
    return this.access.add(id, user.id, user.tenantId!, dto.userId, dto.role);
  }

  @Delete(":id/access/:memberUserId")
  @UseGuards(JwtAuthGuard)
  removeAccess(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("memberUserId") memberUserId: string) {
    return this.access.remove(id, user.id, memberUserId);
  }
}
