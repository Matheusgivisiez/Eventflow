import { Module } from "@nestjs/common";
import { AbacatePayGateway } from "./abacate-pay.gateway";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, AbacatePayGateway],
  exports: [PaymentsService, AbacatePayGateway]
})
export class PaymentsModule {}
