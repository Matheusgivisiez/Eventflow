import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { ReportsService } from "./reports.service";

@Processor("reports")
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(private readonly reportsService: ReportsService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Iniciando geração do relatorio (Job ID: ${job.id})...`);
    
    try {
      const { tenantId, query } = job.data;
      
      const file = await this.reportsService.export(tenantId, query);
      
      this.logger.log(`Relatorio gerado com sucesso! Arquivo: ${file.fileName} (${file.buffer.length} bytes)`);
      return { success: true, fileName: file.fileName };
    } catch (error: any) {
      this.logger.error(`Erro ao processar relatorio: ${error.message}`);
      throw error;
    }
  }
}
