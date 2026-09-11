import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CacheModule } from "../cache/cache.module";
import { PaymentsModule } from "../payments/payments.module";
import { BuyerController } from "./buyer.controller";
import { BuyerService } from "./buyer.service";

@Module({
  imports: [AuditModule, CacheModule, PaymentsModule],
  controllers: [BuyerController],
  providers: [BuyerService],
  exports: [BuyerService]
})
export class BuyerModule {}
