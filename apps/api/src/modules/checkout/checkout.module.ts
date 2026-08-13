import { Module } from "@nestjs/common";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutUseCase } from "./use-cases/create-checkout.use-case";

import { CouponsModule } from "../coupons/coupons.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [CouponsModule, PaymentsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CreateCheckoutUseCase],
  exports: [CheckoutService]
})
export class CheckoutModule {}
