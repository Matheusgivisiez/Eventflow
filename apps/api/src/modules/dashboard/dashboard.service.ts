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

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfLastWeek = new Date(now);
    startOfLastWeek.setDate(now.getDate() - 14);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      paid,
      ticketsSold,
      activeEvents,
      closedEvents,
      monthly,
      pendingOrders,
      checkIns,
      participantsByEvent,
      // Crescimento semanal
      revenueThisWeek,
      revenueLastWeek,
      ticketsThisWeek,
      ticketsLastWeek,
      // Crescimento mensal
      revenueThisMonth,
      revenueLastMonth,
      // Top eventos por receita
      topEvents,
      // Próximos eventos
      upcomingEvents,
      // Novos compradores esta semana
      newBuyersThisWeek,
      newBuyersLastWeek
    ] = await Promise.all([
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
        select: { id: true, title: true, tickets: { select: { id: true, status: true } } },
        take: 10,
        orderBy: { startsAt: "desc" }
      }),
      // Weekly revenue current
      this.prisma.order.aggregate({
        where: { event: { tenantId }, status: PaymentStatus.PAID, createdAt: { gte: startOfWeek } },
        _sum: { totalCents: true }
      }),
      // Weekly revenue previous
      this.prisma.order.aggregate({
        where: { event: { tenantId }, status: PaymentStatus.PAID, createdAt: { gte: startOfLastWeek, lt: startOfWeek } },
        _sum: { totalCents: true }
      }),
      // Tickets this week
      this.prisma.ticket.count({ where: { event: { tenantId }, createdAt: { gte: startOfWeek } } }),
      // Tickets last week
      this.prisma.ticket.count({ where: { event: { tenantId }, createdAt: { gte: startOfLastWeek, lt: startOfWeek } } }),
      // Revenue this month
      this.prisma.order.aggregate({
        where: { event: { tenantId }, status: PaymentStatus.PAID, createdAt: { gte: startOfMonth } },
        _sum: { totalCents: true }
      }),
      // Revenue last month
      this.prisma.order.aggregate({
        where: { event: { tenantId }, status: PaymentStatus.PAID, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { totalCents: true }
      }),
      // Top 5 events by revenue
      this.prisma.event.findMany({
        where: { tenantId },
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          orders: {
            where: { status: PaymentStatus.PAID },
            select: { totalCents: true }
          },
          tickets: { select: { id: true, status: true } }
        },
        orderBy: { startsAt: "desc" },
        take: 20
      }),
      // Upcoming events (next 30 days)
      this.prisma.event.findMany({
        where: { tenantId, status: EventStatus.PUBLISHED, startsAt: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) } },
        select: { id: true, title: true, startsAt: true, city: true, format: true },
        orderBy: { startsAt: "asc" },
        take: 5
      }),
      // New buyers this week
      this.prisma.order.groupBy({
        by: ["buyerEmail"],
        where: { event: { tenantId }, status: PaymentStatus.PAID, createdAt: { gte: startOfWeek } },
        _count: true
      }),
      // New buyers last week
      this.prisma.order.groupBy({
        by: ["buyerEmail"],
        where: { event: { tenantId }, status: PaymentStatus.PAID, createdAt: { gte: startOfLastWeek, lt: startOfWeek } },
        _count: true
      })
    ]);

    // Build revenue by month chart data
    const revenueByMonth = monthly.reduce<Record<string, number>>((acc, order) => {
      const key = order.createdAt.toISOString().slice(0, 7);
      acc[key] = (acc[key] ?? 0) + order.totalCents;
      return acc;
    }, {});

    // Compute growth helpers
    const weekRevenueNow = revenueThisWeek._sum.totalCents ?? 0;
    const weekRevenuePrev = revenueLastWeek._sum.totalCents ?? 0;
    const monthRevenueNow = revenueThisMonth._sum.totalCents ?? 0;
    const monthRevenuePrev = revenueLastMonth._sum.totalCents ?? 0;

    const growthPct = (current: number, prev: number) =>
      prev === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - prev) / prev) * 100);

    // Top events sorted by total revenue
    const topEventsSorted = topEvents
      .map((ev) => ({
        id: ev.id,
        title: ev.title,
        status: ev.status,
        startsAt: ev.startsAt,
        revenueCents: ev.orders.reduce((sum, o) => sum + o.totalCents, 0),
        ticketsSold: ev.tickets.length,
        checkIns: ev.tickets.filter((t) => t.status === "USED").length
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5);

    const visitorsEstimate = paid._count + pendingOrders + Math.max(40, Math.round((paid._count + pendingOrders) * 1.6));

    const result = {
      // Core KPIs
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

      // Growth
      weeklyRevenueCents: weekRevenueNow,
      weeklyRevenueGrowthPct: growthPct(weekRevenueNow, weekRevenuePrev),
      weeklyTickets: ticketsThisWeek,
      weeklyTicketsGrowthPct: growthPct(ticketsThisWeek, ticketsLastWeek),
      monthlyRevenueCents: monthRevenueNow,
      monthlyRevenueGrowthPct: growthPct(monthRevenueNow, monthRevenuePrev),
      newBuyersThisWeek: newBuyersThisWeek.length,
      newBuyersGrowthPct: growthPct(newBuyersThisWeek.length, newBuyersLastWeek.length),

      // Charts
      revenueByMonth: Object.entries(revenueByMonth).map(([month, totalCents]) => ({ month, totalCents })),

      // Tables
      topEvents: topEventsSorted,
      upcomingEvents,
      participantsByEvent: participantsByEvent.map((event) => ({
        eventId: event.id,
        title: event.title,
        total: event.tickets.length,
        used: event.tickets.filter((t) => t.status === "USED").length
      }))
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }
}
