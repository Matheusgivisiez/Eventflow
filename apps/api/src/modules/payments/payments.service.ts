import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import { createHash, createHmac, randomUUID } from "crypto";
import QRCode from "qrcode";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdatePaymentStatusDto } from "./dto/update-payment-status.dto";
import { MercadoPagoGateway } from "./mercado-pago.gateway";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPago: MercadoPagoGateway
  ) {}

  list(tenantId: string, query: { page?: string; perPage?: string; status?: PaymentStatus }) {
    const page = Number(query.page ?? 1);
    const perPage = Number(query.perPage ?? 10);
    return this.prisma.payment.findMany({
      where: { event: { tenantId }, status: query.status },
      include: { order: true, event: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage
    });
  }

  async createProviderPreference(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { event: true, payment: true } });
    if (!order || !order.payment) {
      throw new NotFoundException("Pedido nao encontrado.");
    }
    return this.mercadoPago.createPreference({
      orderId,
      amountCents: order.totalCents,
      buyerEmail: order.buyerEmail,
      description: order.event.title
    });
  }

  async updateStatus(id: string, tenantId: string, dto: UpdatePaymentStatusDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, event: { tenantId } },
      include: { order: { include: { items: true } }, event: true }
    });
    if (!payment) {
      throw new NotFoundException("Pagamento nao encontrado.");
    }
    if (payment.status === PaymentStatus.PAID && dto.status === PaymentStatus.PAID) {
      return payment;
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: dto.status,
        providerRef: dto.providerRef ?? payment.providerRef,
        paidAt: dto.status === PaymentStatus.PAID ? new Date() : undefined,
        canceledAt: dto.status === PaymentStatus.CANCELED ? new Date() : undefined,
        refundedAt: dto.status === PaymentStatus.REFUNDED ? new Date() : undefined,
        order: { update: { status: dto.status } }
      }
    });

    if (dto.status === PaymentStatus.PAID) {
      await this.emitTickets(payment.orderId);
      await this.prisma.ledgerEntry.create({
        data: {
          tenantId: payment.event.tenantId,
          description: `Venda ${payment.event.title}`,
          amountCents: payment.amountCents - payment.order.feeCents,
          feeCents: payment.order.feeCents,
          reference: payment.id
        }
      });
    }

    if (dto.status === PaymentStatus.CANCELED || dto.status === PaymentStatus.REFUNDED) {
      await this.prisma.ticket.updateMany({
        where: { orderId: payment.orderId },
        data: { status: TicketStatus.CANCELED }
      });
    }

    return updated;
  }

  private async emitTickets(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true, items: true }
    });
    if (!order || order.tickets.length > 0) {
      return;
    }

    for (const item of order.items) {
      for (let index = 0; index < item.quantity; index += 1) {
        const uuid = randomUUID();
        const secret = process.env.QR_CODE_SECRET || "change-me-qrcode-secret";
        const signature = createHmac("sha256", secret).update(`${uuid}:${order.id}`).digest("hex");
        // We hash uuid to prevent direct lookup attacks if db is leaked
        const hash = createHash("sha256").update(uuid).digest("hex");
        
        const payload = JSON.stringify({ uuid, orderId: order.id, signature });
        const qrCodeDataUrl = await QRCode.toDataURL(payload);
        
        await this.prisma.ticket.create({
          data: {
            uuid,
            hash,
            signature,
            orderId: order.id,
            eventId: order.eventId,
            ticketTypeId: item.ticketTypeId,
            attendeeName: order.buyerName,
            attendeeEmail: order.buyerEmail,
            qrCodeDataUrl
          }
        });
      }
    }
  }
}
