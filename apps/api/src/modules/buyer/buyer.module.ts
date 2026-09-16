import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CacheModule } from "../cache/cache.module";
import { PaymentsModule } from "../payments/payments.module";
import { WalletModule } from "../wallet/wallet.module";
import { BuyerController } from "./buyer.controller";
import { BuyerService } from "./buyer.service";

@Module({
  imports: [AuditModule, CacheModule, PaymentsModule, WalletModule],
  controllers: [BuyerController],
  providers: [BuyerService],
  exports: [BuyerService]
})
export class BuyerModule {}
