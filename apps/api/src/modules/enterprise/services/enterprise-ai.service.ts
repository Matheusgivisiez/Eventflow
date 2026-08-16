import { Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseAiService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async aiDashboard(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [forecasts, insights, fraudSignals] = await Promise.all([
      db.aiForecast.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.aiInsight.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.fraudSignal.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    return { forecasts, insights, fraudSignals };
  }

  async createForecast(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const eventId = this.string(body.eventId);
    const paidOrders = await this.prisma.order.count({ where: { event: { tenantId }, ...(eventId ? { eventId } : {}), status: PaymentStatus.PAID } });
    const pendingOrders = await this.prisma.order.count({ where: { event: { tenantId }, ...(eventId ? { eventId } : {}), status: PaymentStatus.PENDING } });
    const velocity = Math.max(1, paidOrders / Math.max(1, Number(body.observedDays ?? 7)));
    const horizonDays = Number(body.horizonDays ?? 30);
    const outputJson = {
      salesForecast: Math.round(paidOrders + velocity * horizonDays),
      nextBatchTriggerInDays: Math.max(1, Math.round(7 - velocity)),
      suggestedPriceLiftBps: velocity > 15 ? 800 : velocity > 5 ? 400 : 0,
      behaviorSummary: pendingOrders > paidOrders ? "Alta friccao no checkout; revisar pagamento e prova social." : "Conversao saudavel para o volume atual."
    };
    return this.db().aiForecast.create({
      data: {
        tenantId,
        eventId,
        type: this.string(body.type) ?? "SALES",
        horizonDays,
        inputJson: { paidOrders, pendingOrders, body },
        outputJson,
        confidence: Math.min(0.92, 0.55 + paidOrders / 1000)
      }
    });
  }

  async executiveDashboard(user: RequestUser) {
    const tenantId = user.role === "ADMIN" ? undefined : this.requireTenant(user);
    const db = this.db();
    const where = tenantId ? { event: { tenantId }, status: PaymentStatus.PAID } : { status: PaymentStatus.PAID };
    const [orders, organizers, activeSubscriptions, snapshots] = await Promise.all([
      this.prisma.order.aggregate({ where, _sum: { totalCents: true, feeCents: true }, _count: true }),
      this.prisma.tenant.count(),
      this.prisma.subscription.count({ where: { endsAt: null } }),
      db.executiveMetricSnapshot.findMany({ where: tenantId ? { tenantId } : {}, orderBy: { createdAt: "desc" }, take: 12 })
    ]);
    const revenueCents = orders._sum.totalCents ?? 0;
    const profitCents = orders._sum.feeCents ?? Math.round(revenueCents * 0.08);
    const mrrCents = activeSubscriptions * 49900;
    return {
      mrrCents,
      arrCents: mrrCents * 12,
      ltvCents: Math.round(mrrCents * 18),
      cacCents: 35000,
      churnRateBps: 320,
      revenueCents,
      profitCents,
      organizersCount: organizers,
      paidOrders: orders._count,
      snapshots
    };
  }
}
