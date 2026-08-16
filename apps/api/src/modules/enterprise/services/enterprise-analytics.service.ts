import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseAnalyticsService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async analyticsDashboard(user: RequestUser, query: Record<string, string>) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const eventId = query.eventId;
    const where = { tenantId, ...(eventId ? { eventId } : {}) };
    const [events, integrations, heatmaps, funnels] = await Promise.all([
      db.analyticsEvent.groupBy({ by: ["type"], where, _count: true }),
      db.analyticsIntegration.findMany({ where: { tenantId } }),
      db.heatmapSnapshot.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 }),
      db.conversionFunnel.findMany({ where })
    ]);
    const source = await db.analyticsEvent.groupBy({ by: ["source"], where, _count: true });
    const devices = await db.analyticsEvent.groupBy({ by: ["device"], where, _count: true });
    const campaigns = await db.analyticsEvent.groupBy({ by: ["campaign"], where, _count: true });
    return { events, source, devices, campaigns, integrations, heatmaps, funnels };
  }

  trackAnalytics(body: AnyRecord) {
    return this.db().analyticsEvent.create({
      data: {
        tenantId: this.string(body.tenantId),
        eventId: this.string(body.eventId),
        sessionId: this.string(body.sessionId),
        type: this.string(body.type) ?? "page_view",
        source: this.string(body.source),
        medium: this.string(body.medium),
        campaign: this.string(body.campaign),
        device: this.string(body.device),
        path: this.string(body.path),
        metadata: body.metadata ?? {}
      }
    });
  }

  upsertAnalyticsIntegration(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().analyticsIntegration.create({
      data: {
        tenantId,
        provider: this.string(body.provider) ?? "GOOGLE_ANALYTICS",
        externalId: this.requiredString(body.externalId, "externalId"),
        configJson: body.configJson ?? {},
        isActive: body.isActive !== false
      }
    });
  }
}
