import { Module } from "@nestjs/common";
import { BuyerController } from "./buyer.controller";
import { BuyerService } from "./buyer.service";

@Module({
  controllers: [BuyerController],
  providers: [BuyerService],
  exports: [BuyerService]
})
export class BuyerModule {}
