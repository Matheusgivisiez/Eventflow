import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BuyerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService
  ) {}

  listTickets(email: string, scope?: "future" | "past") {
    const now = new Date();
    return this.prisma.ticket.findMany({
      where: {
        OR: [{ attendeeEmail: email }, { order: { buyerEmail: email } }],
        event: scope === "future" ? { startsAt: { gte: now } } : scope === "past" ? { startsAt: { lt: now } } : undefined
      },
      include: {
        event: true,
        ticketType: true,
        order: { include: { payment: true } }
      },
      orderBy: { event: { startsAt: "asc" } }
    });
  }

  async requestRefund(userId: string, email: string, ticketId: string) {
    const ticket = await this.findOwnedTicket(email, ticketId);
    if (ticket.status !== TicketStatus.AVAILABLE) {
      throw new BadRequestException("Somente ingressos disponiveis podem solicitar reembolso.");
    }

    const payment = await this.prisma.payment.findFirst({
      where: { orderId: ticket.orderId },
      include: { event: true }
    });

    if (!payment) {
      throw new NotFoundException("Pagamento do pedido nao encontrado.");
    }

    if (payment.status === PaymentStatus.PAID) {
      await this.payments.updateStatus(payment.id, payment.event.tenantId, { status: PaymentStatus.REFUNDED });
    }

    await this.audit.log({
      userId,
      action: "refund.requested",
      entity: "ticket",
      entityId: ticket.id,
      metadata: { orderId: ticket.orderId, eventId: ticket.eventId, paymentId: payment.id }
    });
    return { message: "Reembolso processado.", status: "REFUNDED" };
  }

  async ticketPdf(email: string, ticketId: string) {
    const ticket = await this.findOwnedTicket(email, ticketId);
    const content = [
      `EventHub - Ingresso`,
      `Evento: ${ticket.event.title}`,
      `Participante: ${ticket.attendeeName}`,
      `Email: ${ticket.attendeeEmail}`,
      `Lote: ${ticket.ticketType.name}`,
      `Codigo: ${ticket.uuid}`,
      `Status: ${ticket.status}`
    ].join("\n");
    return this.simplePdf(content);
  }

  async walletPayload(email: string, ticketId: string, provider: "google" | "apple") {
    const ticket = await this.findOwnedTicket(email, ticketId);
    return {
      provider,
      passType: "event_ticket",
      id: ticket.uuid,
      eventName: ticket.event.title,
      holderName: ticket.attendeeName,
      startsAt: ticket.event.startsAt,
      venue: ticket.event.format === "ONLINE" ? "Online" : [ticket.event.address, ticket.event.city, ticket.event.state].filter(Boolean).join(", "),
      barcode: {
        format: "QR_CODE",
        message: JSON.stringify({ uuid: ticket.uuid, orderId: ticket.orderId, signature: ticket.signature })
      }
    };
  }

  private async findOwnedTicket(email: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, OR: [{ attendeeEmail: email }, { order: { buyerEmail: email } }] },
      include: { event: true, ticketType: true, order: true }
    });
    if (!ticket) {
      throw new NotFoundException("Ingresso nao encontrado.");
    }
    return ticket;
  }

  private simplePdf(text: string) {
    const safe = text.replace(/[()\\]/g, "").replace(/\\n/g, "\n");
    const lines = safe.split("\n");
    const contentLines = lines.map((line, i) => {
      const y = 780 - i * 18;
      return y >= 40 ? `BT /F1 12 Tf 40 ${y} Td (${line}) Tj ET` : "";
    }).filter(Boolean).join("\n");
    const streamLength = Buffer.byteLength(contentLines, "utf8");
    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj",
      "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
      `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentLines}\nendstream\nendobj`
    ];
    const body = objects.join("\n");
    const xrefOffset = `%PDF-1.4\n${body}\n`.length;
    const xref = `xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000261 00000 n \n0000000320 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(`%PDF-1.4\n${body}\n${xref}`, "utf8");
  }
}
