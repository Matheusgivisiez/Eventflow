import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportsProcessor } from "./reports.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "reports"
    })
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsProcessor],
  exports: [ReportsService]
})
export class ReportsModule {}
