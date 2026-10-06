import { Controller, Get, Query, Res, StreamableFile, UseGuards, ForbiddenException } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TeamPermission, UserRole } from "@prisma/client";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { TeamPermissionGuard } from "../../common/guards/team-permission.guard";
import { teamEventIds } from "../../common/services/team-event-scope";
import { PrismaService } from "../../prisma/prisma.service";
import { ReportsService } from "./reports.service";

@ApiTags("Relatórios")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
@Roles(UserRole.ADMIN, UserRole.ORGANIZER, UserRole.TEAM)
@RequirePermissions(TeamPermission.VIEW_SALES)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService, private readonly prisma: PrismaService) {}

  @Get("events")
  async events(@CurrentUser() user: RequestUser) {
    const ids = user.role === UserRole.TEAM ? await teamEventIds(this.prisma, user, TeamPermission.VIEW_SALES) : undefined;
    return this.prisma.event.findMany({
      where: { tenantId: user.tenantId!, ...(ids ? { id: { in: ids } } : {}) },
      select: { id: true, title: true }, orderBy: { startsAt: "desc" }
    });
  }

  @Get()
  async summary(@CurrentUser() user: RequestUser, @Query() query: { from?: string; to?: string; eventId?: string }) {
    const ids = user.role === UserRole.TEAM ? await teamEventIds(this.prisma, user, TeamPermission.VIEW_SALES) : undefined;
    return this.reports.summary(user.tenantId!, query, ids);
  }

  @Get("export")
  async export(
    @CurrentUser() user: RequestUser,
    @Query() query: { from?: string; to?: string; eventId?: string; format?: "csv" | "excel" | "pdf"; type?: "sales" | "participants" },
    @Res({ passthrough: true }) response: Response
  ) {
    if (user.role === UserRole.TEAM && query.type === "participants") {
      throw new ForbiddenException("Esta permissão permite exportar apenas vendas.");
    }
    const ids = user.role === UserRole.TEAM ? await teamEventIds(this.prisma, user, TeamPermission.VIEW_SALES) : undefined;
    const file = await this.reports.export(user.tenantId!, query, ids);
    response.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Content-Length": file.buffer.length.toString()
    });
    return new StreamableFile(file.buffer);
  }
}
