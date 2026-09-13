import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AbacatePayGateway } from "./abacate-pay.gateway";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, AbacatePayGateway],
  exports: [PaymentsService, AbacatePayGateway]
})
export class PaymentsModule {}
