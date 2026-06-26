import { Injectable, NotFoundException } from "@nestjs/common";
import { EventStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { EventsRepository } from "./events.repository";

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsRepository,
    private readonly cache: CacheService
  ) {}

  list(tenantId: string, query: { page?: string; perPage?: string; search?: string; status?: EventStatus }) {
    return this.events.list(tenantId, {
      page: Number(query.page ?? 1),
      perPage: Number(query.perPage ?? 10),
      search: query.search,
      status: query.status
    });
  }

  async publicList(query: { page?: string; perPage?: string; search?: string; category?: string }) {
    const cacheKey = `events:public:${JSON.stringify(query)}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.events.findPublicEvents({
      page: Number(query.page ?? 1),
      perPage: Number(query.perPage ?? 12),
      search: query.search,
      category: query.category
    });

    await this.cache.set(cacheKey, result, 30);
    return result;
  }

  async create(tenantId: string, ownerId: string, dto: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: {
        ...dto,
        tenantId,
        ownerId,
        slug: await this.uniqueSlug(dto.title),
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        galleryUrls: dto.galleryUrls ?? [],
        onlineUrl: dto.onlineUrl,
        faqJson: dto.faqJson,
        agendaJson: dto.agendaJson,
        salesStartsAt: dto.salesStartsAt ? new Date(dto.salesStartsAt) : undefined,
        salesEndsAt: dto.salesEndsAt ? new Date(dto.salesEndsAt) : undefined,
        limitPerCpf: dto.limitPerCpf,
        feeAbsorbedByOrganizer: dto.feeAbsorbedByOrganizer ?? false
      }
    });
    await this.invalidatePublicCache();
    return event;
  }

  async findOne(id: string, tenantId: string) {
    const event = await this.events.findByIdForTenant(id, tenantId);
    if (!event) {
      throw new NotFoundException("Evento nao encontrado.");
    }
    return event;
  }

  async publicBySlug(slug: string) {
    const cacheKey = `events:public:slug:${slug}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const event = await this.events.findPublicBySlug(slug);
    if (!event) {
      throw new NotFoundException("Evento indisponivel.");
    }
    await this.cache.set(cacheKey, event, 30);
    return event;
  }

  async update(id: string, tenantId: string, dto: UpdateEventDto) {
    await this.findOne(id, tenantId);
    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        galleryUrls: dto.galleryUrls,
        onlineUrl: dto.onlineUrl,
        faqJson: dto.faqJson,
        agendaJson: dto.agendaJson,
        salesStartsAt: dto.salesStartsAt ? new Date(dto.salesStartsAt) : undefined,
        salesEndsAt: dto.salesEndsAt ? new Date(dto.salesEndsAt) : undefined,
        limitPerCpf: dto.limitPerCpf,
        feeAbsorbedByOrganizer: dto.feeAbsorbedByOrganizer
      }
    });
    await this.invalidatePublicCache();
    return event;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.event.delete({ where: { id } });
    await this.invalidatePublicCache();
  }

  private async invalidatePublicCache() {
    await this.cache.del("events:public:*");
  }

  private async uniqueSlug(title: string) {
    const base = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    let slug = base || nanoid(8);
    const exists = await this.prisma.event.findUnique({ where: { slug } });
    if (exists) {
      slug = `${base}-${nanoid(6)}`;
    }
    return slug;
  }
}
