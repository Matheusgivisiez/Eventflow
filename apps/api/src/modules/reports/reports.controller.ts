import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { ReportsService } from "./reports.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@ApiTags("Relatorios")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    @InjectQueue("reports") private readonly reportsQueue: Queue
  ) {}

  @Get()
  summary(@CurrentUser() user: RequestUser, @Query() query: { from?: string; to?: string; eventId?: string }) {
    return this.reports.summary(user.tenantId!, query);
  }

  @Get("export")
  async export(
    @CurrentUser() user: RequestUser,
    @Query() query: { from?: string; to?: string; eventId?: string; format?: "csv" | "excel" | "pdf"; type?: "sales" | "participants" }
  ) {
    const job = await this.reportsQueue.add("export-report", {
      tenantId: user.tenantId!,
      query
    });

    return {
      message: "Exportacao solicitada com sucesso. Voce recebera uma notificacao quando o arquivo estiver pronto.",
      jobId: job.id
    };
  }
}
