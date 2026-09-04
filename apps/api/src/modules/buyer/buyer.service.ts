import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  getQrCodeReleaseTime,
  isQrCodeLocked,
} from "../../common/utils/qr-code.utils";

@Injectable()
export class BuyerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
  ) {}

  async listTickets(userId: string, email: string, scope?: "future" | "past") {
    const now = new Date();
    const normalizedEmail = email.toLowerCase();
    await this.reconcileOwnedOrders(userId, normalizedEmail);
    const eventScope =
      scope === "future"
        ? {
            OR: [
              { endsAt: { gte: now } },
              { endsAt: null, startsAt: { gte: now } },
            ],
          }
        : scope === "past"
          ? {
              OR: [
                { endsAt: { lt: now } },
                { endsAt: null, startsAt: { lt: now } },
              ],
            }
          : undefined;

    const tickets = await this.prisma.ticket.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            ownerId: null,
            OR: [
              { order: { userId } },
              { attendeeEmail: normalizedEmail },
              { order: { buyerEmail: normalizedEmail } },
            ],
          },
        ],
        event: eventScope,
      },
      include: {
        event: true,
        ticketType: true,
        order: { include: { payment: true } },
      },
      orderBy: { event: { startsAt: scope === "past" ? "desc" : "asc" } },
    });

    return tickets.map((ticket) => {
      const locked = isQrCodeLocked(ticket.event);
      const releaseTime = getQrCodeReleaseTime(ticket.event);

      return {
        ...ticket,
        qrCodeDataUrl: locked ? null : ticket.qrCodeDataUrl,
        uuid: locked ? null : ticket.uuid,
        signature: locked ? null : ticket.signature,
        qrCodeLocked: locked,
        qrCodeReleaseAt: releaseTime?.toISOString() ?? null,
        event: {
          ...ticket.event,
          allowTicketTransfer: ticket.event.allowTicketTransfer,
          ticketTransferLockTime:
            ticket.event.ticketTransferLockTime?.toISOString() ?? null,
        },
      };
    });
  }

  private async reconcileOwnedOrders(userId: string, email: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PAID] },
        OR: [
          { userId },
          { userId: null, buyerEmail: email },
        ],
      },
      select: {
        id: true,
        status: true,
        event: { select: { tenantId: true } },
        payment: { select: { id: true } },
        _count: { select: { tickets: true } },
      },
    });

    await Promise.all(orders.map(async (order) => {
      if (!order.payment || order._count.tickets > 0) return;

      if (order.status === PaymentStatus.PENDING) {
        await this.payments.reconcileProviderStatus(order.payment.id, order.event.tenantId);
        return;
      }

      await this.payments.updateStatus(order.payment.id, order.event.tenantId, {
        status: PaymentStatus.PAID,
      });
    }));
  }

  async requestRefund(userId: string, email: string, ticketId: string, confirmation: string) {
    this.confirmSensitiveAction(confirmation);
    const ticket = await this.findOwnedTicket(userId, email, ticketId);
    if (ticket.status !== TicketStatus.AVAILABLE) {
      throw new BadRequestException(
        "Somente ingressos disponiveis podem solicitar reembolso.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const canceled = await tx.ticket.updateMany({
        where: { id: ticket.id, status: TicketStatus.AVAILABLE },
        data: { status: TicketStatus.CANCELED },
      });
      if (canceled.count !== 1) {
        throw new BadRequestException("Este ingresso já foi cancelado.");
      }

      const stockReleased = await tx.ticketType.updateMany({
        where: { id: ticket.ticketTypeId, sold: { gt: 0 } },
        data: { sold: { decrement: 1 } },
      });
      if (stockReleased.count !== 1) {
        throw new BadRequestException("Não foi possível liberar a vaga deste ingresso.");
      }

      if (ticket.seatId) {
        await tx.seat.updateMany({
          where: { id: ticket.seatId, status: "SOLD" },
          data: { status: "AVAILABLE" },
        });
        await tx.seatReservation.updateMany({
          where: { seatId: ticket.seatId, eventId: ticket.eventId, orderId: ticket.orderId },
          data: { status: "AVAILABLE" },
        });
      }
    });

    await this.audit.log({
      userId,
      action: "refund.requested",
      entity: "ticket",
      entityId: ticket.id,
      metadata: {
        orderId: ticket.orderId,
        eventId: ticket.eventId,
        scope: "individual_ticket",
      },
    });
    return {
      message: "Ingresso cancelado individualmente. A solicitação de reembolso foi registrada.",
      status: "REFUND_REQUESTED",
    };
  }

  async ticketPdf(userId: string, email: string, ticketId: string) {
    const ticket = await this.findOwnedTicket(userId, email, ticketId);

    if (isQrCodeLocked(ticket.event)) {
      throw new BadRequestException(
        "O QR Code ainda não está disponível. Aguarde a liberação próxima ao evento.",
      );
    }

    const content = [
      `Event Flow - Ingresso`,
      `Evento: ${ticket.event.title}`,
      `Participante: ${ticket.attendeeName}`,
      `Email: ${ticket.attendeeEmail}`,
      `Lote: ${ticket.ticketType.name}`,
      `Codigo: ${ticket.uuid}`,
      `Status: ${ticket.status}`,
    ].join("\n");
    return this.simplePdf(content);
  }

  async walletPayload(
    userId: string,
    email: string,
    ticketId: string,
    provider: "google" | "apple",
  ) {
    const ticket = await this.findOwnedTicket(userId, email, ticketId);

    if (isQrCodeLocked(ticket.event)) {
      throw new BadRequestException(
        "O QR Code ainda não está disponível. Aguarde a liberação próxima ao evento.",
      );
    }

    return {
      provider,
      passType: "event_ticket",
      id: ticket.uuid,
      eventName: ticket.event.title,
      holderName: ticket.attendeeName,
      startsAt: ticket.event.startsAt,
      venue:
        ticket.event.format === "ONLINE"
          ? "Online"
          : [ticket.event.address, ticket.event.city, ticket.event.state]
              .filter(Boolean)
              .join(", "),
      barcode: {
        format: "QR_CODE",
        message: JSON.stringify({
          uuid: ticket.uuid,
          orderId: ticket.orderId,
          signature: ticket.signature,
        }),
      },
    };
  }

  private async findOwnedTicket(
    userId: string,
    email: string,
    ticketId: string,
  ) {
    const normalizedEmail = email.toLowerCase();
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        OR: [
          { ownerId: userId },
          {
            ownerId: null,
            OR: [
              { attendeeEmail: normalizedEmail },
              { order: { buyerEmail: normalizedEmail } },
            ],
          },
        ],
      },
      include: { event: true, ticketType: true, order: true },
    });
    if (!ticket) {
      throw new NotFoundException("Ingresso nao encontrado.");
    }
    return ticket;
  }

  private confirmSensitiveAction(confirmation: string) {
    if (confirmation.trim().toUpperCase() !== "CONFIRMAR") {
      throw new BadRequestException("Digite CONFIRMAR para concluir esta ação.");
    }
  }

  private simplePdf(text: string) {
    const safe = text.replace(/[()\\]/g, "").replace(/\\n/g, "\n");
    const lines = safe.split("\n");
    const contentLines = lines
      .map((line, i) => {
        const y = 780 - i * 18;
        return y >= 40 ? `BT /F1 12 Tf 40 ${y} Td (${line}) Tj ET` : "";
      })
      .filter(Boolean)
      .join("\n");
    const streamLength = Buffer.byteLength(contentLines, "utf8");
    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj",
      "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
      `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentLines}\nendstream\nendobj`,
    ];
    const body = objects.join("\n");
    const xrefOffset = `%PDF-1.4\n${body}\n`.length;
    const xref = `xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000261 00000 n \n0000000320 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(`%PDF-1.4\n${body}\n${xref}`, "utf8");
  }
}
