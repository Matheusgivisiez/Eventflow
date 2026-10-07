import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventStatus, PaymentStatus, Prisma, TicketOrigin, TicketStatus } from "@prisma/client";
import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import * as QRCode from "qrcode";
import { CourtesyOrigin, defaultCourtesyLabel } from "../../common/utils/ticket-origin";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CacheService } from "../cache/cache.service";
import { PURCHASE_CONFIRMED_DEDUPE_PREFIX } from "../notifications/notifications.service";
import { PaymentsService } from "../payments/payments.service";
import { GoogleWalletService } from "../wallet/google-wallet.service";
import { IssueCourtesyDto, MAX_TICKETS_PER_GUEST } from "./dto/issue-courtesy.dto";

/** Quantos e-mails de convite saem em paralelo. O envio é síncrono (SMTP). */
const EMAIL_CONCURRENCY = 5;
const LIST_LIMIT = 500;

type Issuer = { id: string };

type NormalizedGuest = { name: string; email: string; quantity: number };

/**
 * Ingressos emitidos sem venda.
 *
 * Duas origens, mesma mecânica, visibilidade oposta:
 *  - PLATFORM_COURTESY: convidado da Eventflow. O admin emite em qualquer
 *    evento. Vale na portaria como qualquer ingresso, mas não entra em nenhuma
 *    contagem, lista ou relatório do organizador.
 *  - ORGANIZER_COURTESY: cortesia do dono do evento. Ele vê quantas emitiu e
 *    quantas entraram, separado das vendas.
 *
 * Em nenhum dos casos há cobrança: não existe Payment nem lançamento no
 * extrato, e o estoque dos lotes não é tocado (o ingresso fica em um tipo
 * interno, sem quantidade e fora de venda).
 */
@Injectable()
export class CourtesyService {
  private readonly logger = new Logger(CourtesyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    @Optional() private readonly googleWallet?: GoogleWalletService
  ) {}

  async issue(eventId: string, origin: CourtesyOrigin, issuer: Issuer, dto: IssueCourtesyDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, tenantId: true, status: true, startsAt: true, endsAt: true }
    });
    if (!event) throw new NotFoundException("Evento não encontrado.");
    if (event.status === EventStatus.CLOSED) {
      throw new BadRequestException("Este evento está encerrado. Não é possível emitir ingressos.");
    }
    // Sem horário de término cadastrado, o evento ainda pode estar rolando:
    // a emissão na porta continua liberada por um dia a partir do início.
    const effectiveEnd = event.endsAt ?? new Date(event.startsAt.getTime() + 24 * 60 * 60 * 1000);
    if (effectiveEnd < new Date()) {
      throw new BadRequestException("Este evento já terminou. Não é possível emitir ingressos.");
    }

    const guests = this.normalizeGuests(dto.guests);
    const label = dto.label?.trim() || defaultCourtesyLabel(origin);
    const secret = this.qrSecret();

    const orders = await this.prisma.$transaction(async (tx) => {
      const ticketType = await this.findOrCreateTicketType(tx, event, origin, label);
      const created: { id: string; ticketCount: number }[] = [];

      for (const guest of guests) {
        const order = await tx.order.create({
          data: {
            eventId: event.id,
            buyerName: guest.name,
            buyerEmail: guest.email,
            subtotalCents: 0,
            discountCents: 0,
            feeCents: 0,
            totalCents: 0,
            status: PaymentStatus.PAID,
            origin,
            issuedById: issuer.id,
            source: "courtesy",
            orderAccessToken: randomBytes(32).toString("base64url"),
            items: {
              create: { ticketTypeId: ticketType.id, quantity: guest.quantity, unitCents: 0, totalCents: 0 }
            }
          },
          select: { id: true }
        });

        const tickets = await Promise.all(
          Array.from({ length: guest.quantity }, () => this.buildTicket(secret, order.id, event.id, ticketType.id, origin, guest))
        );
        await tx.ticket.createMany({ data: tickets });
        created.push({ id: order.id, ticketCount: tickets.length });
      }
      return created;
    }, { timeout: 20000 });

    const ticketCount = orders.reduce((sum, order) => sum + order.ticketCount, 0);

    await this.audit.log({
      userId: issuer.id,
      action: "courtesy.issued",
      entity: "event",
      entityId: event.id,
      metadata: {
        origin,
        label,
        note: dto.note?.trim() || null,
        ticketCount,
        orderIds: orders.map((order) => order.id),
        guests: guests.map((guest) => ({ email: guest.email, quantity: guest.quantity }))
      }
    }).catch((error: unknown) => this.logger.error(`Falha ao auditar emissão de cortesia no evento ${event.id}: ${this.message(error)}`));

    // Depois do commit, nunca dentro: SMTP lento não pode segurar a transação
    // e uma falha de e-mail não desfaz o ingresso (o link continua valendo).
    if (dto.sendEmail !== false) {
      await this.sendInvitations(orders.map((order) => order.id));
    }

    // Só a cortesia do organizador muda algo no painel dele.
    if (origin === TicketOrigin.ORGANIZER_COURTESY) {
      await this.cache.del(`dashboard:${event.tenantId}`).catch(() => undefined);
    }

    return { issuedTickets: ticketCount, issuedOrders: orders.length, ...(await this.list(event.id, origin)) };
  }

  async list(eventId: string, origin: CourtesyOrigin) {
    const where = { eventId, origin };
    const [tickets, byStatus] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        select: {
          id: true,
          uuid: true,
          attendeeName: true,
          attendeeEmail: true,
          status: true,
          usedAt: true,
          createdAt: true,
          ticketType: { select: { name: true } },
          order: { select: { id: true, orderAccessToken: true, issuedById: true } }
        },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT
      }),
      this.prisma.ticket.groupBy({ by: ["status"], where, _count: { _all: true } })
    ]);

    const orderIds = [...new Set(tickets.map((ticket) => ticket.order.id))];
    const issuerIds = [...new Set(tickets.map((ticket) => ticket.order.issuedById).filter((id): id is string => Boolean(id)))];
    const [issuers, emails] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: issuerIds } }, select: { id: true, name: true } }),
      this.prisma.notificationLog.findMany({
        where: { dedupeKey: { in: orderIds.map((id) => `${PURCHASE_CONFIRMED_DEDUPE_PREFIX}${id}`) } },
        select: { dedupeKey: true, status: true }
      })
    ]);
    const issuerName = new Map(issuers.map((user) => [user.id, user.name]));
    const emailStatus = new Map(emails.map((log) => [log.dedupeKey, log.status]));

    const count = (status: TicketStatus) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const available = count(TicketStatus.AVAILABLE);
    const used = count(TicketStatus.USED);

    return {
      summary: {
        /** Ingressos válidos emitidos (cancelados não contam). */
        issued: available + used,
        checkedIn: used,
        pending: available,
        canceled: count(TicketStatus.CANCELED)
      },
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        code: ticket.uuid.replace(/-/g, "").slice(0, 10).toUpperCase(),
        guestName: ticket.attendeeName,
        guestEmail: ticket.attendeeEmail,
        label: ticket.ticketType.name,
        status: ticket.status,
        usedAt: ticket.usedAt,
        createdAt: ticket.createdAt,
        issuedBy: ticket.order.issuedById ? issuerName.get(ticket.order.issuedById) ?? null : null,
        emailStatus: emailStatus.get(`${PURCHASE_CONFIRMED_DEDUPE_PREFIX}${ticket.order.id}`) ?? null,
        // Mesmo link do e-mail. Serve de plano B quando o convidado não acha a mensagem.
        ticketUrl: this.ticketUrl(ticket.order.id, ticket.order.orderAccessToken)
      }))
    };
  }

  /**
   * Cancela um ingresso de cortesia ainda não utilizado. `eventId` restringe a
   * busca ao evento da rota do organizador; o admin cancela pelo id do ingresso.
   */
  async cancel(ticketId: string, origin: CourtesyOrigin, issuer: Issuer, eventId?: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, origin, ...(eventId ? { eventId } : {}) },
      select: { id: true, uuid: true, status: true, orderId: true, eventId: true, event: { select: { tenantId: true } } }
    });
    if (!ticket) throw new NotFoundException("Ingresso não encontrado.");
    if (ticket.status === TicketStatus.USED) {
      throw new BadRequestException("Este ingresso já foi utilizado na portaria e não pode ser cancelado.");
    }
    if (ticket.status === TicketStatus.CANCELED) return { id: ticket.id, status: TicketStatus.CANCELED };

    await this.prisma.$transaction(async (tx) => {
      const canceled = await tx.ticket.updateMany({
        where: { id: ticket.id, status: TicketStatus.AVAILABLE },
        data: { status: TicketStatus.CANCELED }
      });
      if (canceled.count !== 1) {
        throw new BadRequestException("Este ingresso acabou de ser utilizado ou cancelado.");
      }
      const remaining = await tx.ticket.count({ where: { orderId: ticket.orderId, status: { not: TicketStatus.CANCELED } } });
      if (remaining === 0) {
        await tx.order.update({ where: { id: ticket.orderId }, data: { status: PaymentStatus.CANCELED } });
      }
    });

    void this.googleWallet?.deactivateTicket(ticket.uuid);
    await this.audit.log({
      userId: issuer.id,
      action: "courtesy.canceled",
      entity: "ticket",
      entityId: ticket.id,
      metadata: { origin, eventId: ticket.eventId, orderId: ticket.orderId }
    }).catch((error: unknown) => this.logger.error(`Falha ao auditar cancelamento de cortesia ${ticket.id}: ${this.message(error)}`));
    if (origin === TicketOrigin.ORGANIZER_COURTESY) {
      await this.cache.del(`dashboard:${ticket.event.tenantId}`).catch(() => undefined);
    }
    return { id: ticket.id, status: TicketStatus.CANCELED };
  }

  /** Visão do admin: quantos ingressos especiais existem por evento, nas duas origens. */
  async countsByEvent() {
    const rows = await this.prisma.ticket.groupBy({
      by: ["eventId", "origin", "status"],
      where: { origin: { not: TicketOrigin.SALE }, status: { not: TicketStatus.CANCELED } },
      _count: { _all: true }
    });
    const byEvent = new Map<string, { eventId: string; platformIssued: number; platformCheckedIn: number; organizerIssued: number; organizerCheckedIn: number }>();
    for (const row of rows) {
      const entry = byEvent.get(row.eventId) ?? { eventId: row.eventId, platformIssued: 0, platformCheckedIn: 0, organizerIssued: 0, organizerCheckedIn: 0 };
      const used = row.status === TicketStatus.USED ? row._count._all : 0;
      if (row.origin === TicketOrigin.PLATFORM_COURTESY) {
        entry.platformIssued += row._count._all;
        entry.platformCheckedIn += used;
      } else {
        entry.organizerIssued += row._count._all;
        entry.organizerCheckedIn += used;
      }
      byEvent.set(row.eventId, entry);
    }
    return [...byEvent.values()];
  }

  private normalizeGuests(guests: IssueCourtesyDto["guests"]): NormalizedGuest[] {
    return guests.map((guest) => {
      const name = guest.name.trim().replace(/\s+/g, " ");
      const email = guest.email.trim().toLowerCase();
      const quantity = guest.quantity ?? 1;
      if (name.length < 2) throw new BadRequestException("Informe o nome de cada convidado.");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_GUEST) {
        throw new BadRequestException(`Cada convidado pode receber de 1 a ${MAX_TICKETS_PER_GUEST} ingressos.`);
      }
      return { name, email, quantity };
    });
  }

  /**
   * Tipo interno que carrega o nome impresso no ingresso. Nasce inativo, sem
   * quantidade e com origem diferente de SALE: o checkout não o vende e as
   * telas do organizador não o listam como lote.
   */
  private async findOrCreateTicketType(
    tx: Prisma.TransactionClient,
    event: { id: string; startsAt: Date },
    origin: CourtesyOrigin,
    name: string
  ) {
    const existing = await tx.ticketType.findFirst({ where: { eventId: event.id, origin, name }, select: { id: true } });
    if (existing) return existing;
    const now = new Date();
    return tx.ticketType.create({
      data: {
        eventId: event.id,
        name,
        origin,
        quantity: 0,
        sold: 0,
        priceCents: 0,
        limitPerBuy: 1,
        isActive: false,
        startsAt: now,
        endsAt: now
      },
      select: { id: true }
    });
  }

  /** Mesmo formato e assinatura dos ingressos vendidos: a portaria valida igual. */
  private async buildTicket(
    secret: string,
    orderId: string,
    eventId: string,
    ticketTypeId: string,
    origin: CourtesyOrigin,
    guest: NormalizedGuest
  ) {
    const uuid = randomUUID();
    const signature = createHmac("sha256", secret).update(`${uuid}:${orderId}`).digest("hex");
    const hash = createHash("sha256").update(uuid).digest("hex");
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify({ uuid, orderId, signature }));
    return {
      uuid,
      hash,
      signature,
      orderId,
      eventId,
      ticketTypeId,
      origin,
      attendeeName: guest.name,
      attendeeEmail: guest.email,
      qrCodeDataUrl
    };
  }

  private async sendInvitations(orderIds: string[]) {
    for (let index = 0; index < orderIds.length; index += EMAIL_CONCURRENCY) {
      // dispatchPurchaseConfirmed nunca lança: registra a falha e o reenvio
      // automático de notificações tenta de novo depois.
      await Promise.all(orderIds.slice(index, index + EMAIL_CONCURRENCY).map((orderId) => this.payments.dispatchPurchaseConfirmed(orderId)));
    }
  }

  private ticketUrl(orderId: string, accessToken: string | null) {
    if (!accessToken) return null;
    const base = (this.config.get<string>("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
    return `${base}/checkout/success?${new URLSearchParams({ orderId, accessToken }).toString()}`;
  }

  private qrSecret() {
    const secret = this.config.get<string>("QR_CODE_SECRET");
    if (!secret) throw new Error("QR_CODE_SECRET is required.");
    return secret;
  }

  private message(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
