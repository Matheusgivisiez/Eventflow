import { Controller, Get, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { ReportsService } from "./reports.service";

@ApiTags("Relatorios")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.buffer);
  }
}
