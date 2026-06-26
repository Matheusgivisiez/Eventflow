import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventsService } from "../events/events.service";
import { CreateTicketTypeDto } from "./dto/create-ticket-type.dto";
import { UpdateTicketTypeDto } from "./dto/update-ticket-type.dto";

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService
  ) {}

  async create(eventId: string, tenantId: string, dto: CreateTicketTypeDto) {
    await this.events.findOne(eventId, tenantId);
    if (new Date(dto.endsAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException("A data final de venda deve ser posterior ao inicio.");
    }
    return this.prisma.ticketType.create({
      data: {
        ...dto,
        eventId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt)
      }
    });
  }

  list(eventId: string, tenantId: string) {
    return this.prisma.ticketType.findMany({ where: { eventId, event: { tenantId } }, orderBy: { priceCents: "asc" } });
  }

  async update(id: string, tenantId: string, dto: UpdateTicketTypeDto) {
    const ticket = await this.prisma.ticketType.findFirst({ where: { id, event: { tenantId } } });
    if (!ticket) {
      throw new NotFoundException("Lote de ingresso nao encontrado.");
    }
    return this.prisma.ticketType.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined
      }
    });
  }

  async remove(id: string, tenantId: string) {
    const ticket = await this.prisma.ticketType.findFirst({ where: { id, event: { tenantId } } });
    if (!ticket) {
      throw new NotFoundException("Lote de ingresso nao encontrado.");
    }
    return this.prisma.ticketType.delete({ where: { id } });
  }
}
