import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService]
})
export class TransfersModule {}
