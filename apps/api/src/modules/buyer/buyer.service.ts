import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TicketStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BuyerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
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
    await this.audit.log({
      userId,
      action: "refund.requested",
      entity: "ticket",
      entityId: ticket.id,
      metadata: { orderId: ticket.orderId, eventId: ticket.eventId }
    });
    return { message: "Solicitacao de reembolso registrada.", status: "REQUESTED" };
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
    const safe = text.replace(/[()\\]/g, "");
    const stream = `BT /F1 12 Tf 40 780 Td (${safe.replace(/\n/g, ") Tj 0 -18 Td (")}) Tj ET`;
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
      "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
      `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`
    ];
    return Buffer.from(`%PDF-1.4\n${objects.join("\n")}\ntrailer << /Root 1 0 R >>\n%%EOF`, "utf8");
  }
}
