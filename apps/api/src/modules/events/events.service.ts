import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventFormat, EventStatus } from "@prisma/client";
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
    this.validateCreation(dto);
    const { firstTicket, ...eventDto } = dto;
    const startsAt = new Date(dto.startsAt);
    const event = await this.prisma.$transaction(async (tx) => {
      const createdEvent = await tx.event.create({
        data: {
          ...eventDto,
          tenantId,
          ownerId,
          slug: await this.uniqueSlug(dto.title),
          startsAt,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
          galleryUrls: dto.galleryUrls ?? [],
          onlineUrl: dto.onlineUrl,
          faqJson: dto.faqJson,
          agendaJson: dto.agendaJson,
          salesStartsAt: dto.salesStartsAt ? new Date(dto.salesStartsAt) : undefined,
          salesEndsAt: dto.salesEndsAt ? new Date(dto.salesEndsAt) : undefined,
          limitPerCpf: dto.limitPerCpf,
          feeAbsorbedByOrganizer: dto.feeAbsorbedByOrganizer ?? false,
          allowTicketTransfer: dto.allowTicketTransfer,
          ticketTransferLockTime: dto.ticketTransferLockTime ? new Date(dto.ticketTransferLockTime) : undefined,
          qrCodeReleaseMinutesBeforeStart: dto.qrCodeReleaseMinutesBeforeStart,
          qrCodeReleaseAt: dto.qrCodeReleaseAt ? new Date(dto.qrCodeReleaseAt) : undefined
        }
      });

      if (firstTicket) {
        await tx.ticketType.create({
          data: {
            eventId: createdEvent.id,
            name: firstTicket.name,
            quantity: firstTicket.quantity,
            priceCents: firstTicket.priceCents,
            limitPerBuy: firstTicket.limitPerBuy ?? 5,
            startsAt: new Date(),
            endsAt: startsAt,
            isActive: true
          }
        });
      }

      return createdEvent;
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
        feeAbsorbedByOrganizer: dto.feeAbsorbedByOrganizer,
        allowTicketTransfer: dto.allowTicketTransfer,
        ticketTransferLockTime: dto.ticketTransferLockTime ? new Date(dto.ticketTransferLockTime) : undefined,
        qrCodeReleaseMinutesBeforeStart: dto.qrCodeReleaseMinutesBeforeStart,
        qrCodeReleaseAt: dto.qrCodeReleaseAt ? new Date(dto.qrCodeReleaseAt) : undefined
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

  async duplicate(id: string, tenantId: string, ownerId: string) {
    const source = await this.findOne(id, tenantId);
    const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, ...rest } = source as any;
    const newEvent = await this.prisma.event.create({
      data: {
        ...rest,
        title: `${source.title} (copia)`,
        slug: await this.uniqueSlug(`${source.title} copia`),
        status: "DRAFT" as any,
        ownerId,
        tenantId
      }
    });
    return newEvent;
  }

  async cancel(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    const event = await this.prisma.event.update({
      where: { id },
      data: { status: "CLOSED" as any }
    });
    await this.cache.del(`dashboard:${tenantId}`);
    await this.invalidatePublicCache();
    return event;
  }

  private async invalidatePublicCache() {
    await this.cache.delByPattern("events:public:*");
  }

  private validateCreation(dto: CreateEventDto) {
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException("Informe uma data de inicio valida.");
    }
    if (startsAt <= new Date()) {
      throw new BadRequestException("A data de inicio deve ser futura.");
    }
    if (dto.endsAt && new Date(dto.endsAt) <= startsAt) {
      throw new BadRequestException("A data de fim deve ser posterior ao inicio.");
    }
    if (dto.format === EventFormat.IN_PERSON) {
      const required = [dto.zipCode, dto.city, dto.state, dto.address];
      if (required.some((value) => !value?.trim())) {
        throw new BadRequestException("Eventos presenciais precisam de CEP, cidade, estado e endereco.");
      }
    }
    if (dto.format === EventFormat.ONLINE && !dto.onlineUrl?.trim()) {
      throw new BadRequestException("Eventos online precisam do link de transmissao.");
    }
    if (dto.status === EventStatus.PUBLISHED && !dto.firstTicket) {
      throw new BadRequestException("Publique o evento somente com ao menos um lote de ingressos.");
    }
    if (dto.firstTicket && dto.firstTicket.quantity < 1) {
      throw new BadRequestException("O primeiro lote precisa ter quantidade maior que zero.");
    }
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
