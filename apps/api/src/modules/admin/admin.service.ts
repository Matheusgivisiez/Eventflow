import { Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  users() {
    return this.prisma.user.findMany({
      select: { id: true, tenantId: true, name: true, email: true, phone: true, role: true, createdAt: true, tenant: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  events() {
    return this.prisma.event.findMany({
      include: { tenant: true, owner: { select: { id: true, name: true, email: true } }, ticketTypes: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  payments(status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: { status },
      include: { event: true, order: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  logs() {
    return this.prisma.checkInLog.findMany({
      include: { ticket: { include: { event: true } }, user: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }
}
