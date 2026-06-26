import { Module } from "@nestjs/common";
import { CheckInController } from "./checkin.controller";
import { CheckInService } from "./checkin.service";
import { ValidateTicketUseCase } from "./use-cases/validate-ticket.use-case";

@Module({
  controllers: [CheckInController],
  providers: [CheckInService, ValidateTicketUseCase],
  exports: [CheckInService]
})
export class CheckInModule {}
