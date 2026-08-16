import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseCrmService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  crmCustomers(user: RequestUser, query: Record<string, string>) {
    const tenantId = this.requireTenant(user);
    return this.db().crmCustomer.findMany({
      where: {
        tenantId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: Number(query.take ?? 100)
    });
  }

  createCrmCustomer(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const email = this.requiredString(body.email, "email").toLowerCase();
    return this.db().crmCustomer.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: {
        tenantId,
        email,
        name: this.requiredString(body.name, "name"),
        document: this.string(body.document),
        phone: this.string(body.phone),
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        consentEmail: Boolean(body.consentEmail),
        consentWhatsApp: Boolean(body.consentWhatsApp),
        consentPush: Boolean(body.consentPush)
      },
      update: {
        name: this.string(body.name),
        document: this.string(body.document),
        phone: this.string(body.phone),
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        consentEmail: body.consentEmail === undefined ? undefined : Boolean(body.consentEmail),
        consentWhatsApp: body.consentWhatsApp === undefined ? undefined : Boolean(body.consentWhatsApp),
        consentPush: body.consentPush === undefined ? undefined : Boolean(body.consentPush)
      }
    });
  }

  createSegment(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().crmSegment.create({
      data: { tenantId, name: this.requiredString(body.name, "name"), rulesJson: body.rulesJson ?? {}, size: Number(body.size ?? 0) }
    });
  }
}
