import { Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import type { IOrdersRepository } from "../../common/repositories/orders-repository.interface";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrdersRepository implements IOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.order.findUnique({ where: { id }, include: { items: true, payment: true } });
  }

  findByEventId(eventId: string) {
    return this.prisma.order.findMany({ where: { eventId } });
  }

  findByBuyerEmail(email: string) {
    return this.prisma.order.findMany({ where: { buyerEmail: email } });
  }

  create(data: any) {
    return this.prisma.order.create({ data });
  }

  updateStatus(id: string, status: PaymentStatus) {
    return this.prisma.order.update({ where: { id }, data: { status } });
  }
}
