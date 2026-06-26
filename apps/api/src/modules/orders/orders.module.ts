import { Module } from "@nestjs/common";
import { OrdersRepository } from "./orders.repository";

@Module({
  providers: [OrdersRepository],
  exports: [OrdersRepository]
})
export class OrdersModule {}
