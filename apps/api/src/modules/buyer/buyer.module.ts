import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PaymentsModule } from "../payments/payments.module";
import { BuyerController } from "./buyer.controller";
import { BuyerService } from "./buyer.service";

@Module({
  imports: [AuditModule, PaymentsModule],
  controllers: [BuyerController],
  providers: [BuyerService],
  exports: [BuyerService]
})
export class BuyerModule {}
