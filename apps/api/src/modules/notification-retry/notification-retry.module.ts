import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { NotificationRetryService } from "./notification-retry.service";

@Module({
  imports: [PaymentsModule],
  providers: [NotificationRetryService],
  exports: [NotificationRetryService]
})
export class NotificationRetryModule {}
