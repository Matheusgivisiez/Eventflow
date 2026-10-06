import { Injectable } from "@nestjs/common";
import { EventStatus, Prisma } from "@prisma/client";
import { paginate } from "../../common/repositories/base.repository";
import type { IEventsRepository } from "../../common/repositories/events-repository.interface";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class EventsRepository implements IEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private publicAvailabilityWhere(now = new Date()): Prisma.EventWhereInput {
    return {
      OR: [
        { endsAt: { gte: now } },
        { endsAt: null, startsAt: { gte: now } }
      ]
    };
  }

  async list(tenantId: string, options: { page: number; perPage: number; search?: string; status?: EventStatus; summary?: boolean; userId?: string; restricted?: boolean; scopedIds?: string[] | null; scopedOwnerId?: string; checkInOnly?: boolean }) {
    const accessFilter: Prisma.EventWhereInput = options.scopedIds !== undefined
      ? options.scopedIds === null ? { ownerId: options.scopedOwnerId } : { id: { in: options.scopedIds } }
      : options.restricted && options.userId
        ? { OR: [
            { ownerId: options.userId },
            { accessMembers: { some: { userId: options.userId, ...(options.checkInOnly ? { role: { in: ["GESTOR", "OPERACAO"] } } : {}) } } }
          ] }
        : {};
    const where: Prisma.EventWhereInput = {
      tenantId,
      status: options.status,
      AND: [
        accessFilter,
        options.search ? { OR: [
            { title: { contains: options.search, mode: "insensitive" } },
            { city: { contains: options.search, mode: "insensitive" } },
            { category: { contains: options.search, mode: "insensitive" } }
          ] } : {}
      ]
    };
    const query = options.summary || options.restricted
      ? this.prisma.event.findMany({
          where,
          select: {
            id: true, title: true, slug: true, category: true, bannerUrl: true,
            startsAt: true, endsAt: true, city: true, state: true, format: true, status: true, ownerId: true,
            ticketTypes: {
              select: options.restricted
                ? { id: true, name: true, isActive: true, startsAt: true, endsAt: true }
                : { id: true, name: true, quantity: true, sold: true, priceCents: true, isActive: true },
              orderBy: options.restricted ? { name: "asc" } : { priceCents: "asc" }
            }
          },
          orderBy: { startsAt: "desc" },
          skip: (options.page - 1) * options.perPage,
          take: options.perPage
        })
      : this.prisma.event.findMany({
          where,
          include: { ticketTypes: true },
          orderBy: { startsAt: "desc" },
          skip: (options.page - 1) * options.perPage,
          take: options.perPage
        });
    const [data, total] = await this.prisma.$transaction([query, this.prisma.event.count({ where })]);
    return paginate(data, total, options.page, options.perPage);
  }

  findByIdForTenant(id: string, tenantId: string) {
    return this.prisma.event.findFirst({
      where: { id, tenantId },
      include: {
        ticketTypes: true,
        artists: { include: { artist: { select: { id: true, stageName: true, imageUrl: true, instagramUrl: true, spotifyUrl: true, bio: true, genre: true } } }, orderBy: { position: "asc" } },
        tenant: { select: { name: true, logoUrl: true } }
      }
    });
  }

  findPublicBySlug(slug: string) {
    return this.prisma.event.findFirst({
      where: {
        slug,
        status: EventStatus.PUBLISHED,
        isPrivate: false,
        AND: [this.publicAvailabilityWhere()]
      },
      include: {
        ticketTypes: { where: { isActive: true }, orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }] },
        artists: { select: { position: true, artist: { select: { id: true, stageName: true, imageUrl: true, instagramUrl: true, spotifyUrl: true, bio: true, genre: true } } }, orderBy: { position: "asc" } },
        tenant: { select: { name: true, logoUrl: true } }
      }
    });
  }

  findPublishedByInvite(slug: string, inviteTokenHash: string) {
    return this.prisma.event.findFirst({
      where: { slug, status: EventStatus.PUBLISHED, isPrivate: true, inviteTokenHash,
        AND: [this.publicAvailabilityWhere()] },
      include: {
        ticketTypes: { where: { isActive: true }, orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }] },
        artists: { select: { position: true, artist: { select: { id: true, stageName: true, imageUrl: true, instagramUrl: true, spotifyUrl: true, bio: true, genre: true } } }, orderBy: { position: "asc" } },
        tenant: { select: { name: true, logoUrl: true } }
      }
    });
  }

  async findPublicEvents(options: { page: number; perPage: number; search?: string; category?: string }) {
    const now = new Date();
    const where: Prisma.EventWhereInput = {
      status: EventStatus.PUBLISHED,
      isPrivate: false,
      AND: [this.publicAvailabilityWhere(now)],
      OR: options.search
        ? [
            { title: { contains: options.search, mode: "insensitive" } },
            { city: { contains: options.search, mode: "insensitive" } },
            { category: { contains: options.search, mode: "insensitive" } }
          ]
        : undefined,
      category: options.category
        ? { equals: options.category, mode: "insensitive" }
        : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: {
          ticketTypes: { where: { isActive: true }, orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }] },
          tenant: { select: { name: true, logoUrl: true } }
        },
        orderBy: { startsAt: "asc" },
        skip: (options.page - 1) * options.perPage,
        take: options.perPage
      }),
      this.prisma.event.count({ where })
    ]);
    return paginate(data, total, options.page, options.perPage);
  }
}
