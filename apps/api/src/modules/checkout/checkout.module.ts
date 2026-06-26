import { Module } from "@nestjs/common";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutUseCase } from "./use-cases/create-checkout.use-case";

import { CouponsModule } from "../coupons/coupons.module";

@Module({
  imports: [CouponsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CreateCheckoutUseCase],
  exports: [CheckoutService]
})
export class CheckoutModule {}
