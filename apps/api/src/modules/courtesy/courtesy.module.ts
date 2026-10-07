import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { PaymentsModule } from "../payments/payments.module";
import { WalletModule } from "../wallet/wallet.module";
import { AdminCourtesyController } from "./admin-courtesy.controller";
import { CourtesyService } from "./courtesy.service";
import { EventCourtesyController } from "./event-courtesy.controller";

@Module({
  imports: [EventsModule, PaymentsModule, WalletModule],
  controllers: [AdminCourtesyController, EventCourtesyController],
  providers: [CourtesyService]
})
export class CourtesyModule {}
