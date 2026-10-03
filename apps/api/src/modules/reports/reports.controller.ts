import { Controller, Get, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { ReportsService } from "./reports.service";

@ApiTags("Relatórios")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORGANIZER)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  summary(@CurrentUser() user: RequestUser, @Query() query: { from?: string; to?: string; eventId?: string }) {
    return this.reports.summary(user.tenantId!, query);
  }

  @Get("export")
  async export(
    @CurrentUser() user: RequestUser,
    @Query() query: { from?: string; to?: string; eventId?: string; format?: "csv" | "excel" | "pdf"; type?: "sales" | "participants" },
    @Res({ passthrough: true }) response: Response
  ) {
    const file = await this.reports.export(user.tenantId!, query);
    response.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Content-Length": file.buffer.length.toString()
    });
    return new StreamableFile(file.buffer);
  }
}
