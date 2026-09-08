import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const EXPIRATION_INTERVAL_MS = 60_000;

@Injectable()
export class ReservationExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationExpirationService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  onModuleInit() {
    void this.expireStaleReservations();
    this.timer = setInterval(() => void this.expireStaleReservations(), EXPIRATION_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async expireStaleReservations(now = new Date()) {
    const ttlMinutes = this.config.get<number>("ORDER_RESERVATION_TTL_MINUTES") ?? 30;
    const cutoff = new Date(now.getTime() - ttlMinutes * 60_000);
    const candidates = await this.prisma.order.findMany({
      where: { status: PaymentStatus.PENDING, stockReservedAt: { lte: cutoff } },
      select: { id: true, couponId: true, stockReservedAt: true, items: { select: { ticketTypeId: true, quantity: true } } },
      take: 100
    });

    let expiredOrders = 0;
    for (const candidate of candidates) {
      const expired = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({
          where: { id: candidate.id, status: PaymentStatus.PENDING, stockReservedAt: { lte: cutoff } },
          data: { status: PaymentStatus.CANCELED, stockReservedAt: null }
        });
        if (claim.count !== 1) return false;

        await tx.payment.updateMany({
          where: { orderId: candidate.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.CANCELED, canceledAt: now }
        });
        for (const item of candidate.items) {
          await tx.ticketType.update({ where: { id: item.ticketTypeId }, data: { sold: { decrement: item.quantity } } });
        }
        if (candidate.couponId) {
          await tx.coupon.updateMany({
            where: { id: candidate.couponId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } }
          });
        }
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (expired) expiredOrders += 1;
    }

    if (expiredOrders) this.logger.log(`${expiredOrders} reserva(s) de checkout expirada(s).`);
    return { expiredOrders };
  }
}
