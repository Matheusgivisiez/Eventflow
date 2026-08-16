import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger, OnModuleInit } from "@nestjs/common";
import { ReportsService } from "./reports.service";

type ReportJobData = {
  tenantId: string;
  query: {
    from?: string;
    to?: string;
    eventId?: string;
    format?: "csv" | "excel" | "pdf";
    type?: "sales" | "participants";
  };
};

type ReportJobResult = {
  success: true;
  fileName: string;
};

@Processor("reports")
export class ReportsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(private readonly reportsService: ReportsService) {
    super();
  }

  onModuleInit() {
    this.worker?.on("error", (err) => {
      this.logger.warn(`ReportsProcessor worker warning: ${err.message}`);
    });
  }

  async process(job: Job<ReportJobData, ReportJobResult, string>): Promise<ReportJobResult> {
    this.logger.log(`Iniciando geração do relatorio (Job ID: ${job.id})...`);
    
    try {
      const { tenantId, query } = job.data;
      
      const file = await this.reportsService.export(tenantId, query);
      
      this.logger.log(`Relatorio gerado com sucesso! Arquivo: ${file.fileName} (${file.buffer.length} bytes)`);
      return { success: true, fileName: file.fileName };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      this.logger.error(`Erro ao processar relatorio: ${message}`);
      throw error;
    }
  }
}
