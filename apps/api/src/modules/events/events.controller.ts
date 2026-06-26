import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { EventStatus } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { EventsService } from "./events.service";

@ApiTags("Eventos")
@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get("public")
  @ApiOperation({ summary: "Listar eventos públicos", description: "Retorna eventos publicados para a vitrine." })
  publicList(@Query() query: { page?: string; perPage?: string; search?: string; category?: string }) {
    return this.events.publicList(query);
  }

  @Get("public/:slug")
  @ApiOperation({ summary: "Buscar evento por slug", description: "Retorna os detalhes públicos de um evento." })
  publicBySlug(@Param("slug") slug: string) {
    return this.events.publicBySlug(slug);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Listar eventos do organizador", description: "Retorna eventos paginados do tenant autenticado." })
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: { page?: string; perPage?: string; search?: string; status?: EventStatus }
  ) {
    return this.events.list(user.tenantId!, query);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Criar evento", description: "Cria um novo evento para o tenant autenticado." })
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEventDto) {
    return this.events.create(user.tenantId!, user.id, dto);
  }

  @Get(":id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Buscar evento por ID", description: "Retorna os detalhes de um evento pelo ID." })
  @UseGuards(JwtAuthGuard)
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.events.findOne(id, user.tenantId!);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Atualizar evento", description: "Atualiza os dados de um evento existente." })
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateEventDto) {
    return this.events.update(id, user.tenantId!, dto);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Remover evento", description: "Remove um evento pelo ID." })
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.events.remove(id, user.tenantId!);
  }
}
