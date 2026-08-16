import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { AnyRecord, EnterpriseDomainService } from "./enterprise-domain.service";

@Injectable()
export class EnterpriseMarketplaceService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async marketplaceSearch(query: Record<string, string>) {
    const where: AnyRecord = { status: "PUBLISHED" };
    if (query.category) where.category = query.category;
    if (query.city) where.city = { contains: query.city, mode: "insensitive" };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { category: { contains: query.search, mode: "insensitive" } }
      ];
    }
    return this.prisma.event.findMany({
      where,
      orderBy: [{ isSponsored: "desc" as const }, { marketplaceRank: "desc" as const }, { startsAt: "asc" as const }],
      take: Number(query.take ?? 24),
      include: { ticketTypes: true, tenant: true }
    });
  }

  marketplaceCategories() {
    return this.db().eventCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  upsertMarketplaceProfile(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const displayName = this.requiredString(body.displayName, "displayName");
    const data = {
      displayName,
      slug: this.slug(this.string(body.slug) ?? displayName),
      description: this.string(body.description),
      logoUrl: this.string(body.logoUrl),
      categories: Array.isArray(body.categories) ? body.categories.map(String) : [],
      verification: this.string(body.verification) ?? "PENDING"
    };
    return this.db().marketplaceProfile.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  }

  reviewEvent(user: RequestUser, body: AnyRecord) {
    return this.db().eventReview.create({
      data: {
        eventId: this.requiredString(body.eventId, "eventId"),
        userId: user.id,
        rating: Math.max(1, Math.min(5, Number(body.rating ?? 5))),
        comment: this.string(body.comment),
        isPublic: body.isPublic !== false
      }
    });
  }

  favoriteEvent(user: RequestUser, body: AnyRecord) {
    return this.db().favoriteEvent.upsert({
      where: { userId_eventId: { userId: user.id, eventId: this.requiredString(body.eventId, "eventId") } },
      create: { userId: user.id, eventId: this.requiredString(body.eventId, "eventId") },
      update: {}
    });
  }
}
