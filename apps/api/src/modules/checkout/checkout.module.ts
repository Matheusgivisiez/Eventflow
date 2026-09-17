import { Module } from "@nestjs/common";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutUseCase } from "./use-cases/create-checkout.use-case";
import { ReservationExpirationService } from "./reservation-expiration.service";

import { CouponsModule } from "../coupons/coupons.module";
import { CacheModule } from "../cache/cache.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { BuyerModule } from "../buyer/buyer.module";

import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule, CacheModule, CouponsModule, PaymentsModule, NotificationsModule, BuyerModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CreateCheckoutUseCase, ReservationExpirationService],
  exports: [CheckoutService]
})
export class CheckoutModule {}
