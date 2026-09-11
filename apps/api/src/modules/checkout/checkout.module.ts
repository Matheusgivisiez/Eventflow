import { Module } from "@nestjs/common";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutUseCase } from "./use-cases/create-checkout.use-case";
import { ReservationExpirationService } from "./reservation-expiration.service";

import { CouponsModule } from "../coupons/coupons.module";
import { CacheModule } from "../cache/cache.module";
import { PaymentsModule } from "../payments/payments.module";

import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule, CacheModule, CouponsModule, PaymentsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CreateCheckoutUseCase, ReservationExpirationService],
  exports: [CheckoutService]
})
export class CheckoutModule {}
