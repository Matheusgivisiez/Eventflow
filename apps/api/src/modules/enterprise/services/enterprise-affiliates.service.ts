import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseAffiliatesService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async affiliateDashboard(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [program, links, commissions, payouts] = await Promise.all([
      db.affiliateProgram.findUnique({ where: { tenantId } }),
      db.affiliateLink.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.affiliateCommission.aggregate({ where: { tenantId }, _sum: { amountCents: true }, _count: true }),
      db.affiliatePayout.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    return { program, links, commissions, payouts };
  }

  upsertAffiliateProgram(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const data = {
      name: this.string(body.name) ?? "Programa de afiliados",
      defaultCommissionBps: Number(body.defaultCommissionBps ?? 1000),
      cookieWindowDays: Number(body.cookieWindowDays ?? 30),
      minPayoutCents: Number(body.minPayoutCents ?? 5000),
      isActive: body.isActive !== false,
      termsUrl: this.string(body.termsUrl)
    };
    return this.db().affiliateProgram.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  }

  createAffiliateLink(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const code = this.slug(this.string(body.code) ?? `${this.string(body.affiliateName) ?? "afiliado"}-${randomBytes(3).toString("hex")}`);
    return this.db().affiliateLink.create({
      data: {
        tenantId,
        eventId: this.string(body.eventId),
        affiliateName: this.requiredString(body.affiliateName, "affiliateName"),
        affiliateEmail: this.string(body.affiliateEmail),
        code,
        commissionBps: Number(body.commissionBps ?? 1000)
      }
    });
  }
}
