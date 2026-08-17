import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import { createHash, createHmac, randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import QRCode from "qrcode";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdatePaymentStatusDto } from "./dto/update-payment-status.dto";
import { AbacatePayGateway } from "./abacate-pay.gateway";
import { BusinessMetricsService } from "../observability/business-metrics.service";

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.CANCELED],
  [PaymentStatus.PAID]: [PaymentStatus.REFUNDED, PaymentStatus.CANCELED],
  [PaymentStatus.CANCELED]: [],
  [PaymentStatus.REFUNDED]: []
};

@Injectable()
export class PaymentsService {
  private readonly qrCodeSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly abacatePay: AbacatePayGateway,
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: BusinessMetricsService
  ) {
    const qrCodeSecret = this.config.get<string>("QR_CODE_SECRET");
    if (!qrCodeSecret) {
      throw new Error("QR_CODE_SECRET is required.");
    }
    this.qrCodeSecret = qrCodeSecret;
  }

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

  async createProviderPreference(orderId: string, tenantId?: string | null) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { event: true, payment: true } });
    if (!order || !order.payment) {
      throw new NotFoundException("Pedido nao encontrado.");
    }
    if (tenantId && order.event.tenantId !== tenantId) {
      throw new NotFoundException("Pedido nao encontrado.");
    }
    const appUrl = (this.config.get<string>("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
    const successParams = new URLSearchParams({ orderId });
    if (order.orderAccessToken) {
      successParams.set("accessToken", order.orderAccessToken);
    }
    const successUrl = `${appUrl}/checkout/success?${successParams.toString()}`;
    const ticketsUrl = `${appUrl}/me/ingressos`;
    const result = await this.abacatePay.createCheckout({
      orderId,
      amountCents: order.totalCents,
      buyerEmail: order.buyerEmail,
      buyerName: order.buyerName,
      buyerDocument: order.buyerDocument ?? undefined,
      buyerPhone: order.buyerPhone ?? undefined,
      description: order.event.title,
      paymentMethod: order.payment?.method ?? undefined,
      returnUrl: ticketsUrl,
      completionUrl: `${successUrl}&status=paid`
    });

    await this.prisma.payment.update({
      where: { orderId },
      data: {
        provider: "abacate_pay",
        providerRef: result.providerRef,
        checkoutId: result.checkoutId,
        billId: result.billId,
        transactionId: result.transactionId
      }
    });
    return result;
  }

  async updateStatus(id: string, tenantId: string, dto: UpdatePaymentStatusDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, event: { tenantId } },
      include: { order: { include: { items: { include: { ticketType: true } }, tickets: true } }, event: true }
    });
    if (!payment) {
      throw new NotFoundException("Pagamento nao encontrado.");
    }
    if (payment.status === PaymentStatus.PAID && dto.status === PaymentStatus.PAID) {
      await this.ensurePaidFulfillment(payment.id, tenantId);
      return this.prisma.payment.findUnique({ where: { id } });
    }

    const allowed = VALID_TRANSITIONS[payment.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Transicao de ${payment.status} para ${dto.status} nao permitida.`);
    }

    if (dto.status === PaymentStatus.PAID) {
      return this.markPaid(payment.id, tenantId, dto.providerRef ?? payment.providerRef ?? undefined);
    }

    return this.markTerminal(payment.id, tenantId, dto.status, dto.providerRef ?? payment.providerRef ?? undefined);
  }

  private async markPaid(paymentId: string, tenantId: string, providerRef?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, event: { tenantId } },
        include: { order: { include: { items: { include: { ticketType: true } }, tickets: true } }, event: true }
      });
      if (!payment) throw new NotFoundException("Pagamento nao encontrado.");

      if (payment.status !== PaymentStatus.PAID) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.PAID,
            providerRef,
            paidAt: new Date(),
            order: { update: { status: PaymentStatus.PAID } }
          }
        });
        this.metrics?.increment("eventflow_payment_status_transitions_total", { status: PaymentStatus.PAID });
      }

      await this.ensurePaidFulfillmentTx(tx, payment);

      return tx.payment.findUnique({ where: { id: paymentId } });
    }, { timeout: 20000 });
  }

  private async markTerminal(paymentId: string, tenantId: string, status: PaymentStatus, providerRef?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, event: { tenantId } },
        include: { order: { include: { items: true } }, event: true }
      });
      if (!payment) throw new NotFoundException("Pagamento nao encontrado.");

      const wasPaid = payment.status === PaymentStatus.PAID;
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status,
          providerRef,
          canceledAt: status === PaymentStatus.CANCELED ? new Date() : undefined,
          refundedAt: status === PaymentStatus.REFUNDED ? new Date() : undefined,
          order: { update: { status } }
        }
      });

      await tx.ticket.updateMany({
        where: { orderId: payment.orderId },
        data: { status: TicketStatus.CANCELED }
      });

      if (payment.order.stockReservedAt || wasPaid) {
        await this.releaseReservedStockTx(tx, payment);
      }

      this.metrics?.increment("eventflow_payment_status_transitions_total", { status });

      return updated;
    });
  }

  private async ensurePaidFulfillment(paymentId: string, tenantId: string) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, event: { tenantId } },
        include: { order: { include: { items: { include: { ticketType: true } }, tickets: true } }, event: true }
      });
      if (payment) {
        await this.ensurePaidFulfillmentTx(tx, payment);
      }
    }, { timeout: 20000 });
  }

  private async ensurePaidFulfillmentTx(tx: any, payment: any) {
    const existingTickets = await tx.ticket.count({ where: { orderId: payment.orderId } });

    if (existingTickets === 0) {
      for (const item of payment.order.items) {
        if (!payment.order.stockReservedAt) {
          const updatedStock = await tx.ticketType.updateMany({
            where: {
              id: item.ticketTypeId,
              sold: { lte: item.ticketType.quantity - item.quantity }
            },
            data: { sold: { increment: item.quantity } }
          });

          if (updatedStock.count !== 1) {
            console.warn(`[PaymentsService] Inconsistencia no lote ${item.ticketType.name} (id: ${item.ticketTypeId}) ao incrementar vendas.`);
          }
        }

        if (item.seatIds.length) {
          await tx.seat.updateMany({
            where: { id: { in: item.seatIds }, status: { in: ["HELD", "RESERVED", "AVAILABLE"] } },
            data: { status: "SOLD" }
          });
          await tx.seatReservation.updateMany({
            where: { seatId: { in: item.seatIds }, eventId: payment.eventId },
            data: { status: "SOLD", orderId: payment.orderId }
          });
        }
      }

      await this.emitTicketsTx(tx, payment.order);
    }

    const existingLedger = await tx.ledgerEntry.findFirst({ where: { reference: payment.id } });
    if (!existingLedger) {
      await tx.ledgerEntry.create({
        data: {
          tenantId: payment.event.tenantId,
          description: `Venda ${payment.event.title}`,
          amountCents: payment.amountCents - payment.order.feeCents,
          feeCents: payment.order.feeCents,
          reference: payment.id
        }
      });
    }
  }

  private async emitTicketsTx(tx: any, order: any) {
    const tickets = await Promise.all(
      order.items.flatMap((item) =>
        Array.from({ length: item.quantity }, async (_, index) => {
          const uuid = randomUUID();
          const signature = createHmac("sha256", this.qrCodeSecret).update(`${uuid}:${order.id}`).digest("hex");
          const hash = createHash("sha256").update(uuid).digest("hex");

          const payload = JSON.stringify({ uuid, orderId: order.id, signature });
          const qrCodeDataUrl = await QRCode.toDataURL(payload);

          return {
            uuid,
            hash,
            signature,
            orderId: order.id,
            eventId: order.eventId,
            ticketTypeId: item.ticketTypeId,
            ownerId: order.userId,
            attendeeName: order.buyerName,
            attendeeEmail: order.buyerEmail,
            qrCodeDataUrl,
            seatId: item.seatIds[index]
          };
        })
      )
    );

    if (tickets.length > 0) {
      await tx.ticket.createMany({ data: tickets });
      this.metrics?.increment("eventflow_payment_tickets_emitted_total", {}, tickets.length);
    }
  }

  private async releaseReservedStockTx(tx: any, payment: any) {
    for (const item of payment.order.items) {
      await tx.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { sold: { decrement: item.quantity } }
      });

      if (item.seatIds.length) {
        await tx.seat.updateMany({
          where: { id: { in: item.seatIds }, status: "SOLD" },
          data: { status: "AVAILABLE" }
        });
        await tx.seatReservation.updateMany({
          where: { seatId: { in: item.seatIds }, eventId: payment.eventId, orderId: payment.orderId },
          data: { status: "AVAILABLE" }
        });
      }
    }

    if (payment.order.stockReservedAt) {
      await tx.order.update({
        where: { id: payment.orderId },
        data: { stockReservedAt: null }
      });
    }
  }
}
