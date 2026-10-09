import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { PendingPurchasesController } from "./pending-purchases.controller";
import { PendingPurchasesService } from "./pending-purchases.service";

@Module({
  imports: [PaymentsModule],
  controllers: [PendingPurchasesController],
  providers: [PendingPurchasesService]
})
export class PendingPurchasesModule {}
