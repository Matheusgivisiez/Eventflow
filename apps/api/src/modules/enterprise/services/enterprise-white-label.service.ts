import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseWhiteLabelService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  getWhiteLabel(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    return this.db().whiteLabelSetting.findUnique({ where: { tenantId } });
  }

  upsertWhiteLabel(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const customDomain = this.string(body.customDomain);
    const data = {
      customDomain,
      logoUrl: this.string(body.logoUrl),
      faviconUrl: this.string(body.faviconUrl),
      primaryColor: this.string(body.primaryColor) ?? "#111827",
      secondaryColor: this.string(body.secondaryColor) ?? "#2563eb",
      themeJson: body.themeJson ?? {},
      senderName: this.string(body.senderName),
      senderEmail: this.string(body.senderEmail),
      emailTemplateJson: body.emailTemplateJson ?? {},
      dnsInstructions: customDomain
        ? {
            cname: { name: customDomain, value: "white-label.eventhub.app" },
            txt: { name: `_eventhub.${customDomain}`, value: this.hash(`${tenantId}:${customDomain}`).slice(0, 32) }
          }
        : undefined
    };

    return this.db().whiteLabelSetting.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data
    });
  }

  resolveWhiteLabelDomain(domain?: string) {
    if (!domain) throw new BadRequestException("Informe o dominio.");
    return this.db().whiteLabelSetting.findUnique({ where: { customDomain: domain } });
  }
}
