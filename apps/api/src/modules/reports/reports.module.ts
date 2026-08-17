import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportsProcessor } from "./reports.processor";

const queueWorkersEnabled = process.env.QUEUE_WORKERS_ENABLED === "true";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "reports"
    })
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ...(queueWorkersEnabled ? [ReportsProcessor] : [])],
  exports: [ReportsService]
})
export class ReportsModule {}
