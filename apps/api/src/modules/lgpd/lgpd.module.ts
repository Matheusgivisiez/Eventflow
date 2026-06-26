import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { LgpdProcessor } from "./lgpd.processor";
import { LgpdService } from "./lgpd.service";

@Module({
  imports: [
    BullModule.registerQueue({ name: "lgpd" })
  ],
  providers: [LgpdService, LgpdProcessor],
  exports: [LgpdService]
})
export class LgpdModule {}
