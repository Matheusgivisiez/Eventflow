import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AbacatePayGateway } from "./abacate-pay.gateway";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { InfinitePayGateway } from "./infinite-pay.gateway";

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, AbacatePayGateway, InfinitePayGateway],
  exports: [PaymentsService, AbacatePayGateway, InfinitePayGateway]
})
export class PaymentsModule {}
