import { Module } from "@nestjs/common";
import { MercadoPagoGateway } from "./mercado-pago.gateway";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoGateway],
  exports: [PaymentsService]
})
export class PaymentsModule {}
