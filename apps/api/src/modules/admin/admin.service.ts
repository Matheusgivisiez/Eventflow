import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventsService } from "../events/events.service";
import { TicketsService } from "../tickets/tickets.service";
import { UpdateEventDto } from "../events/dto/update-event.dto";
import { CreateTicketTypeDto } from "../tickets/dto/create-ticket-type.dto";
import { UpdateTicketTypeDto } from "../tickets/dto/update-ticket-type.dto";

const PAGE_SIZE = 30;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly ticketsService: TicketsService
  ) {}

  private async eventTenant(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, select: { tenantId: true } });
    if (!event) throw new NotFoundException("Evento não encontrado.");
    return event.tenantId;
  }

  async manageEvent(id: string) {
    const event = await this.eventsService.findOne(id, await this.eventTenant(id));
    const { inviteTokenHash: _inviteTokenHash, ...safeEvent } = event;
    return { ...safeEvent, accessRole: "ADMIN" };
  }

  async updateManagedEvent(id: string, dto: UpdateEventDto, actorId: string) {
    const event = await this.eventsService.update(id, await this.eventTenant(id), dto);
    await this.prisma.auditLog.create({ data: { userId: actorId, action: "admin.event.updated", entity: "event", entityId: id, metadata: { fields: Object.keys(dto) } } });
    return event;
  }

  async createManagedInviteLink(id: string, actorId: string) {
    const result = await this.eventsService.createInviteLink(id, await this.eventTenant(id));
    await this.prisma.auditLog.create({ data: { userId: actorId, action: "admin.event.invite_link_created", entity: "event", entityId: id } });
    return result;
  }

  async managedTicketTypes(eventId: string) {
    return this.ticketsService.list(eventId, await this.eventTenant(eventId));
  }

  async createManagedTicketType(eventId: string, dto: CreateTicketTypeDto, actorId: string) {
    const ticket = await this.ticketsService.create(eventId, await this.eventTenant(eventId), dto);
    await this.prisma.auditLog.create({ data: { userId: actorId, action: "admin.ticket_type.created", entity: "ticket_type", entityId: ticket.id, metadata: { eventId } } });
    return ticket;
  }

  async updateManagedTicketType(eventId: string, ticketId: string, dto: UpdateTicketTypeDto, actorId: string) {
    const tenantId = await this.eventTenant(eventId);
    const ticket = await this.prisma.ticketType.findFirst({ where: { id: ticketId, eventId }, select: { id: true } });
    if (!ticket) throw new NotFoundException("Lote de ingresso não encontrado.");
    const updated = await this.ticketsService.update(ticketId, tenantId, dto);
    await this.prisma.auditLog.create({ data: { userId: actorId, action: "admin.ticket_type.updated", entity: "ticket_type", entityId: ticketId, metadata: { eventId, fields: Object.keys(dto) } } });
    return updated;
  }

  async removeManagedTicketType(eventId: string, ticketId: string, actorId: string) {
    const tenantId = await this.eventTenant(eventId);
    const ticket = await this.prisma.ticketType.findFirst({ where: { id: ticketId, eventId }, select: { id: true } });
    if (!ticket) throw new NotFoundException("Lote de ingresso não encontrado.");
    const removed = await this.ticketsService.remove(ticketId, tenantId);
    await this.prisma.auditLog.create({ data: { userId: actorId, action: "admin.ticket_type.removed", entity: "ticket_type", entityId: ticketId, metadata: { eventId } } });
    return removed;
  }

  private page(value?: string) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 10000) : 1;
  }

  async overview() {
    const [users, events, payments, revenue] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.event.count(),
      this.prisma.payment.count(),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.PAID }, _sum: { amountCents: true } })
    ]);
    return { users, events, payments, revenueCents: revenue._sum.amountCents ?? 0 };
  }

  users() {
    return this.prisma.user.findMany({
      select: { id: true, tenantId: true, name: true, email: true, phone: true, role: true, createdAt: true, tenant: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async usersPage(search?: string, page?: string) {
    const where: Prisma.UserWhereInput = search?.trim()
      ? { OR: [{ name: { contains: search.trim(), mode: "insensitive" } }, { email: { contains: search.trim(), mode: "insensitive" } }] }
      : {};
    const currentPage = this.page(page);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, tenantId: true, name: true, email: true, phone: true, role: true, createdAt: true, tenant: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" }, skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE
      }),
      this.prisma.user.count({ where })
    ]);
    return { items, total, page: currentPage, pageSize: PAGE_SIZE };
  }

  async user(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, tenant: { select: { name: true } } }
    });
    if (!user) throw new NotFoundException("Usuário não encontrado.");
    const [orders, ownedTickets] = await Promise.all([
      this.prisma.order.findMany({
        where: { OR: [{ userId: id }, { buyerEmail: { equals: user.email, mode: "insensitive" } }] },
        select: {
          id: true, status: true, createdAt: true, totalCents: true, buyerEmail: true,
          event: { select: { id: true, title: true, startsAt: true } },
          items: { select: { quantity: true, ticketType: { select: { id: true, name: true } } } },
          tickets: { select: { id: true, status: true, ticketTypeId: true, ownerId: true } }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.ticket.findMany({
        where: { ownerId: id },
        select: { id: true, status: true, event: { select: { id: true, title: true, startsAt: true } }, ticketType: { select: { name: true } }, orderId: true },
        orderBy: { createdAt: "desc" }
      })
    ]);
    return { user, orders, ownedTickets };
  }

  events() {
    return this.prisma.event.findMany({
      include: { tenant: true, owner: { select: { id: true, name: true, email: true } }, ticketTypes: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async eventsPage(search?: string, page?: string) {
    const where: Prisma.EventWhereInput = search?.trim()
      ? { title: { contains: search.trim(), mode: "insensitive" } }
      : {};
    const currentPage = this.page(page);
    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        select: {
          id: true, title: true, status: true, startsAt: true, format: true,
          tenant: { select: { name: true } }, owner: { select: { name: true, email: true } },
          ticketTypes: { select: { sold: true, quantity: true } }
        },
        orderBy: { createdAt: "desc" }, skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE
      }),
      this.prisma.event.count({ where })
    ]);
    return { items, total, page: currentPage, pageSize: PAGE_SIZE };
  }

  async event(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true, title: true, status: true, startsAt: true,
        tenant: { select: { name: true } }, owner: { select: { name: true, email: true } },
        ticketTypes: { select: { id: true, name: true, quantity: true, sold: true, priceCents: true, startsAt: true, endsAt: true, isActive: true }, orderBy: { createdAt: "asc" } }
      }
    });
    if (!event) throw new NotFoundException("Evento não encontrado.");
    const [ordersByStatus, paymentsByStatus, paidItemsByLot] = await Promise.all([
      this.prisma.order.groupBy({ by: ["status"], where: { eventId: id }, _count: { _all: true } }),
      this.prisma.payment.groupBy({ by: ["status"], where: { eventId: id }, _count: { _all: true }, _sum: { amountCents: true } }),
      this.prisma.orderItem.groupBy({ by: ["ticketTypeId"], where: { order: { eventId: id, status: PaymentStatus.PAID } }, _sum: { quantity: true } })
    ]);
    const paidByLot = new Map(paidItemsByLot.map(item => [item.ticketTypeId, item._sum.quantity ?? 0]));
    return { event: { ...event, ticketTypes: event.ticketTypes.map(lot => ({ ...lot, paid: paidByLot.get(lot.id) ?? 0 })) }, ordersByStatus, paymentsByStatus };
  }

  eventOptions() {
    return this.prisma.event.findMany({
      select: { id: true, title: true, status: true, startsAt: true, tenant: { select: { name: true } }, owner: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  payments(status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: { status },
      include: { event: true, order: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async paymentsPage(status?: PaymentStatus, eventId?: string, page?: string) {
    const where: Prisma.PaymentWhereInput = { ...(status ? { status } : {}), ...(eventId ? { eventId } : {}) };
    const currentPage = this.page(page);
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id: true, status: true, method: true, amountCents: true, createdAt: true, paidAt: true,
          event: { select: { id: true, title: true } },
          order: { select: { id: true, buyerName: true, buyerEmail: true, userId: true } }
        },
        orderBy: { createdAt: "desc" }, skip: (currentPage - 1) * PAGE_SIZE, take: PAGE_SIZE
      }),
      this.prisma.payment.count({ where })
    ]);
    return { items, total, page: currentPage, pageSize: PAGE_SIZE };
  }

  logs() {
    return this.prisma.checkInLog.findMany({
      include: { ticket: { include: { event: true } }, user: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }
}
