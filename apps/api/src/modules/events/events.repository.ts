import { Injectable } from "@nestjs/common";
import { EventStatus, Prisma } from "@prisma/client";
import { paginate } from "../../common/repositories/base.repository";
import type { IEventsRepository } from "../../common/repositories/events-repository.interface";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class EventsRepository implements IEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, options: { page: number; perPage: number; search?: string; status?: EventStatus; summary?: boolean }) {
    const where: Prisma.EventWhereInput = {
      tenantId,
      status: options.status,
      OR: options.search
        ? [
            { title: { contains: options.search, mode: "insensitive" } },
            { city: { contains: options.search, mode: "insensitive" } },
            { category: { contains: options.search, mode: "insensitive" } }
          ]
        : undefined
    };
    const query = options.summary
      ? this.prisma.event.findMany({
          where,
          select: {
            id: true, title: true, slug: true, category: true, bannerUrl: true,
            startsAt: true, endsAt: true, city: true, state: true, format: true, status: true,
            ticketTypes: {
              select: { id: true, name: true, quantity: true, sold: true, priceCents: true, isActive: true },
              orderBy: { priceCents: "asc" }
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
    return this.prisma.event.findFirst({ where: { id, tenantId }, include: { ticketTypes: true } });
  }

  findPublicBySlug(slug: string) {
    return this.prisma.event.findFirst({
      where: { slug, status: EventStatus.PUBLISHED },
      include: { ticketTypes: { where: { isActive: true }, orderBy: { priceCents: "asc" } } }
    });
  }

  async findPublicEvents(options: { page: number; perPage: number; search?: string; category?: string }) {
    const where: Prisma.EventWhereInput = {
      status: EventStatus.PUBLISHED,
      OR: options.search
        ? [
            { title: { contains: options.search, mode: "insensitive" } },
            { city: { contains: options.search, mode: "insensitive" } },
            { category: { contains: options.search, mode: "insensitive" } }
          ]
        : undefined,
      category: options.category || undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: {
          ticketTypes: { where: { isActive: true }, orderBy: { priceCents: "asc" } },
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
