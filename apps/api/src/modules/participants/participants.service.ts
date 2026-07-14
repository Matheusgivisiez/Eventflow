import { Injectable } from "@nestjs/common";
import { PaymentStatus, Prisma, TicketStatus } from "@prisma/client";
import { paginate } from "../../common/repositories/base.repository";
import { PrismaService } from "../../prisma/prisma.service";

type ParticipantQuery = {
  page?: string;
  perPage?: string;
  search?: string;
  eventId?: string;
  status?: TicketStatus;
};

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ParticipantQuery) {
    const page = Number(query.page ?? 1);
    const perPage = Number(query.perPage ?? 20);
    const where: Prisma.TicketWhereInput = {
      event: { tenantId },
      eventId: query.eventId || undefined,
      status: query.status,
      order: { status: PaymentStatus.PAID },
      OR: query.search
        ? [
            { attendeeName: { contains: query.search, mode: "insensitive" } },
            { attendeeEmail: { contains: query.search, mode: "insensitive" } }
          ]
        : undefined
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: {
          event: { select: { id: true, title: true, startsAt: true } },
          ticketType: { select: { id: true, name: true, priceCents: true } },
          order: { select: { id: true, buyerName: true, buyerEmail: true, totalCents: true, createdAt: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      this.prisma.ticket.count({ where })
    ]);

    return paginate(data, total, page, perPage);
  }
}
