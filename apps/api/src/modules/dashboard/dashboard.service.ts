import { Injectable } from "@nestjs/common";
import { CheckInStatus, EventStatus, PaymentStatus } from "@prisma/client";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService
  ) {}

  async summary(tenantId: string) {
    const cacheKey = `dashboard:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [paid, ticketsSold, activeEvents, closedEvents, monthly, pendingOrders, checkIns, participantsByEvent] = await Promise.all([
      this.prisma.order.aggregate({
        where: { event: { tenantId }, status: PaymentStatus.PAID },
        _sum: { totalCents: true, feeCents: true },
        _count: true
      }),
      this.prisma.ticket.count({ where: { event: { tenantId } } }),
      this.prisma.event.count({ where: { tenantId, status: EventStatus.PUBLISHED } }),
      this.prisma.event.count({ where: { tenantId, status: EventStatus.CLOSED } }),
      this.prisma.order.findMany({
        where: { event: { tenantId }, status: PaymentStatus.PAID },
        select: { createdAt: true, totalCents: true },
        orderBy: { createdAt: "asc" },
        take: 250
      }),
      this.prisma.order.count({ where: { event: { tenantId }, status: PaymentStatus.PENDING } }),
      this.prisma.checkInLog.count({ where: { status: CheckInStatus.ENTERED, ticket: { event: { tenantId } } } }),
      this.prisma.event.findMany({
        where: { tenantId },
        select: {
          id: true,
          title: true,
          tickets: { select: { id: true, status: true } }
        },
        take: 10,
        orderBy: { startsAt: "desc" }
      })
    ]);

    const revenueByMonth = monthly.reduce<Record<string, number>>((acc, order) => {
      const key = order.createdAt.toISOString().slice(0, 7);
      acc[key] = (acc[key] ?? 0) + order.totalCents;
      return acc;
    }, {});

    const visitorsEstimate = paid._count + pendingOrders + Math.max(40, Math.round((paid._count + pendingOrders) * 1.6));
    const result = {
      totalRevenueCents: paid._sum.totalCents ?? 0,
      totalFeesCents: paid._sum.feeCents ?? 0,
      ticketsSold,
      activeEvents,
      closedEvents,
      paidOrders: paid._count,
      pendingOrders,
      checkIns,
      visitorsEstimate,
      conversionRate: visitorsEstimate ? Math.round((paid._count / visitorsEstimate) * 100) : 0,
      revenueByMonth: Object.entries(revenueByMonth).map(([month, totalCents]) => ({ month, totalCents })),
      participantsByEvent: participantsByEvent.map((event) => ({
        eventId: event.id,
        title: event.title,
        total: event.tickets.length,
        used: event.tickets.filter((ticket) => ticket.status === "USED").length
      }))
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }
}
