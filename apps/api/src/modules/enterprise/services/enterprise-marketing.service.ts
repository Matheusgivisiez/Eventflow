import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseMarketingService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  createCampaign(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().crmCampaign.create({
      data: {
        tenantId,
        segmentId: this.string(body.segmentId),
        name: this.requiredString(body.name, "name"),
        channel: this.string(body.channel) ?? "EMAIL",
        status: this.string(body.status) ?? "DRAFT",
        subject: this.string(body.subject),
        content: this.requiredString(body.content, "content"),
        scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : undefined,
        metricsJson: body.metricsJson ?? {}
      }
    });
  }

  createAutomation(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().crmAutomation.create({
      data: {
        tenantId,
        name: this.requiredString(body.name, "name"),
        trigger: this.string(body.trigger) ?? "PURCHASE_CONFIRMED",
        channel: this.string(body.channel) ?? "EMAIL",
        isActive: body.isActive !== false,
        rulesJson: body.rulesJson ?? {},
        stepsJson: body.stepsJson ?? []
      }
    });
  }

  async marketingDashboard(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [campaigns, messages, automations] = await Promise.all([
      db.crmCampaign.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.marketingMessage.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.crmAutomation.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 })
    ]);
    return { campaigns, messages, automations };
  }

  queueMarketingMessage(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().marketingMessage.create({
      data: {
        tenantId,
        campaignId: this.string(body.campaignId),
        channel: this.string(body.channel) ?? "EMAIL",
        recipient: this.requiredString(body.recipient, "recipient"),
        payload: body.payload ?? { subject: body.subject, content: body.content }
      }
    });
  }
}
