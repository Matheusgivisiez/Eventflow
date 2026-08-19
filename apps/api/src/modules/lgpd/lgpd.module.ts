import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { LgpdProcessor } from "./lgpd.processor";
import { LgpdService } from "./lgpd.service";

const queueWorkersEnabled = process.env.QUEUE_WORKERS_ENABLED === "true";

@Module({
  imports: [
    BullModule.registerQueue({ name: "lgpd" })
  ],
  providers: [LgpdService, ...(queueWorkersEnabled ? [LgpdProcessor] : [])],
  exports: [LgpdService]
})
export class LgpdModule {}
