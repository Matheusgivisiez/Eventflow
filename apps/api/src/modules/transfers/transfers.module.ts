import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CacheModule } from "../cache/cache.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WalletModule } from "../wallet/wallet.module";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [AuditModule, CacheModule, NotificationsModule, WalletModule],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService]
})
export class TransfersModule {}
