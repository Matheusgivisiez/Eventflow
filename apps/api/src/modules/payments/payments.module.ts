import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AbacatePayGateway } from "./abacate-pay.gateway";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { InfinitePayGateway } from "./infinite-pay.gateway";
import { WalletModule } from "../wallet/wallet.module";

@Module({
  imports: [NotificationsModule, WalletModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, AbacatePayGateway, InfinitePayGateway],
  exports: [PaymentsService, AbacatePayGateway, InfinitePayGateway]
})
export class PaymentsModule {}
