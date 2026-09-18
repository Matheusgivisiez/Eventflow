import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import { createHash, createHmac, randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import * as QRCode from "qrcode";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdatePaymentStatusDto } from "./dto/update-payment-status.dto";
import { AbacatePayGateway } from "./abacate-pay.gateway";
import { InfinitePayGateway } from "./infinite-pay.gateway";
import { PaymentProvider, PaymentProviderId } from "./payment-provider";
import { BusinessMetricsService } from "../observability/business-metrics.service";
import { NotificationsService } from "../notifications/notifications.service";
import { GoogleWalletService } from "../wallet/google-wallet.service";
import { getQrCodeReleaseTime, isQrCodeLocked } from "../../common/utils/qr-code.utils";

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.CANCELED],
  [PaymentStatus.PAID]: [PaymentStatus.REFUNDED, PaymentStatus.CANCELED],
  [PaymentStatus.CANCELED]: [],
  [PaymentStatus.REFUNDED]: []
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly qrCodeSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly abacatePay: AbacatePayGateway,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly metrics?: BusinessMetricsService,
    @Optional() private readonly infinitePay?: InfinitePayGateway,
    @Optional() private readonly googleWallet?: GoogleWalletService
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
    const provider = this.getProviderForNewPayment();
    const result = await provider.createCheckout({
      orderId,
      amountCents: order.totalCents,
      buyerEmail: order.buyerEmail,
      buyerName: order.buyerName,
      buyerDocument: order.buyerDocument ?? undefined,
      buyerPhone: order.buyerPhone ?? undefined,
      description: order.event.title,
      paymentMethod: order.payment?.method ?? undefined,
      returnUrl: successUrl,
      completionUrl: `${successUrl}&status=paid`
    });

    await this.prisma.payment.update({
      where: { orderId },
      data: {
        provider: result.provider,
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
      await this.dispatchPurchaseConfirmed(payment.orderId);
      return this.prisma.payment.findUnique({ where: { id } });
    }

    const allowed = VALID_TRANSITIONS[payment.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Transicao de ${payment.status} para ${dto.status} nao permitida.`);
    }

    if (dto.status === PaymentStatus.PAID) {
      const paid = await this.markPaid(payment.id, tenantId, dto.providerRef ?? payment.providerRef ?? undefined);
      // After the transaction commits, never inside it: SMTP latency must not
      // hold a database transaction and a mail outage must not undo a payment.
      await this.dispatchPurchaseConfirmed(payment.orderId);
      return paid;
    }

    return this.markTerminal(payment.id, tenantId, dto.status, dto.providerRef ?? payment.providerRef ?? undefined);
  }

  async reconcileProviderStatus(id: string, tenantId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, event: { tenantId } },
      include: { event: true }
    });
    if (!payment) {
      throw new NotFoundException("Pagamento nao encontrado.");
    }
    if (!payment.providerRef) {
      return payment;
    }

    // Keep historical providers readable even when this deployment no longer
    // creates new payments with them.
    if (payment.provider !== "abacate_pay" && payment.provider !== "infinite_pay") {
      return payment;
    }

    const provider = this.getProvider(payment.provider);
    const checkout = await provider.verifyPayment({
      orderId: payment.orderId,
      providerRef: payment.providerRef,
      checkoutId: payment.checkoutId,
      transactionId: payment.transactionId
    });
    if (checkout.status === "PAID") {
      // Dois valores precisam bater: o que o provedor diz que foi cobrado e o
      // que foi efetivamente pago. Conferir so o primeiro deixa passar
      // pagamento parcial, que e como um PIX vira ingresso mais barato.
      const chargedCents = checkout.amountCents;
      const paidCents = checkout.paidAmountCents;

      if (chargedCents !== undefined && chargedCents !== payment.amountCents) {
        this.logger.error(`Valor divergente no pagamento ${payment.id}: esperado=${payment.amountCents} cobrado=${chargedCents}`);
        return payment;
      }
      if (paidCents !== undefined && paidCents < payment.amountCents) {
        this.logger.error(`Pagamento parcial em ${payment.id}: esperado=${payment.amountCents} pago=${paidCents}`);
        return payment;
      }
    }
    const status = checkout.status === "PAID"
      ? PaymentStatus.PAID
      : checkout.status === "REFUNDED"
        ? PaymentStatus.REFUNDED
        : checkout.status === "CANCELED"
          ? PaymentStatus.CANCELED
          : PaymentStatus.PENDING;

    if (status === payment.status && status !== PaymentStatus.PAID) {
      return payment;
    }

    return this.updateStatus(payment.id, tenantId, {
      status,
      providerRef: checkout.providerRef ?? checkout.id
    });
  }

  async recordProviderReferences(
    id: string,
    tenantId: string,
    references: { providerRef?: string; checkoutId?: string; transactionId?: string }
  ) {
    const payment = await this.prisma.payment.findFirst({ where: { id, event: { tenantId } } });
    if (!payment) throw new NotFoundException("Pagamento nao encontrado.");
    return this.prisma.payment.update({
      where: { id },
      data: {
        providerRef: references.providerRef ?? payment.providerRef,
        checkoutId: references.checkoutId ?? payment.checkoutId,
        transactionId: references.transactionId ?? payment.transactionId
      }
    });
  }

  private getProviderForNewPayment(): PaymentProvider {
    const provider = (this.config.get<string>("PAYMENT_PROVIDER") ?? "abacate_pay") as PaymentProviderId;
    return this.getProvider(provider);
  }

  private getProvider(provider: string): PaymentProvider {
    if (provider === "abacate_pay") return this.abacatePay;
    if (provider === "infinite_pay" && this.infinitePay) return this.infinitePay;
    throw new Error(`Provedor de pagamento nao configurado: ${provider}`);
  }

  private async markPaid(paymentId: string, tenantId: string, providerRef?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, event: { tenantId } },
        include: { order: { include: { items: { include: { ticketType: true } }, tickets: true } }, event: true }
      });
      if (!payment) throw new NotFoundException("Pagamento nao encontrado.");

      const wasAlreadyPaid = payment.status === PaymentStatus.PAID;

      if (!wasAlreadyPaid) {
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

        // Credit promoter commission only when payment transitions to PAID (idempotent).
        // Commission was calculated at checkout and stored in order.promoterCommissionCents.
        if (payment.order.promoterLinkId && payment.order.promoterCommissionCents > 0) {
          await tx.promoterLink.update({
            where: { id: payment.order.promoterLinkId },
            data: {
              conversions: { increment: 1 },
              revenueCents: { increment: payment.order.totalCents },
              commissionAcumCents: { increment: payment.order.promoterCommissionCents }
            }
          });
        }
      }

      await this.ensurePaidFulfillmentTx(tx, payment);

      return tx.payment.findUnique({ where: { id: paymentId } });
    }, { timeout: 20000 });
  }

  private async markTerminal(paymentId: string, tenantId: string, status: PaymentStatus, providerRef?: string) {
    const updated = await this.markTerminalTx(paymentId, tenantId, status, providerRef);

    if (this.googleWallet?.isEnabled()) {
      const tickets = await this.prisma.ticket.findMany({
        where: { orderId: updated.orderId },
        select: { uuid: true }
      });
      void Promise.all(tickets.map((ticket) => this.googleWallet!.deactivateTicket(ticket.uuid)));
    }

    return updated;
  }

  private async markTerminalTx(paymentId: string, tenantId: string, status: PaymentStatus, providerRef?: string) {
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

      if (!wasPaid && payment.order.couponId) {
        await tx.coupon.updateMany({
          where: { id: payment.order.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } }
        });
      }

      // Reverse promoter commission if the order was previously PAID.
      // This handles REFUNDED scenarios — commission was already credited and must be reversed.
      // For orders cancelled from PENDING, commission was never credited so no reversal needed.
      if (wasPaid && payment.order.promoterLinkId && payment.order.promoterCommissionCents > 0) {
        await tx.promoterLink.update({
          where: { id: payment.order.promoterLinkId },
          data: {
            conversions: { decrement: 1 },
            revenueCents: { decrement: payment.order.totalCents },
            commissionAcumCents: { decrement: payment.order.promoterCommissionCents }
          }
        });
      }

      this.metrics?.increment("eventflow_payment_status_transitions_total", { status });

      return updated;
    });
  }

  /**
   * Single place where an approved purchase becomes a message, whatever the
   * origin: provider webhook, reconciliation, simulated confirmation or an
   * administrative reprocessing. Idempotent through the notification dedupe
   * key, and it never throws — the payment is already committed.
   *
   * Public because NotificationRetryService calls it to re-drive a delivery
   * that got stuck, instead of rebuilding the message on its own.
   */
  async dispatchPurchaseConfirmed(orderId: string) {
    try {
      if (this.config.get<boolean>("PURCHASE_EMAIL_ENABLED") === false) {
        return;
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          event: {
            select: {
              title: true,
              startsAt: true,
              format: true,
              address: true,
              city: true,
              state: true,
              qrCodeReleaseAt: true,
              qrCodeReleaseMinutesBeforeStart: true
            }
          },
          tickets: {
            select: {
              id: true,
              uuid: true,
              attendeeName: true,
              ticketType: { select: { name: true } }
            }
          },
          _count: { select: { tickets: true } }
        }
      });

      if (!order || order.status !== PaymentStatus.PAID) {
        return;
      }

      const eventVenue =
        order.event.format === "ONLINE"
          ? "Online"
          : [order.event.address, order.event.city, order.event.state].filter(Boolean).join(", ") ||
            "Local a confirmar";

      await this.notifications.sendPurchaseApproved({
        userId: order.userId ?? undefined,
        email: order.buyerEmail,
        phone: order.buyerPhone ?? undefined,
        orderId: order.id,
        orderAccessToken: order.orderAccessToken,
        buyerName: order.buyerName,
        eventTitle: order.event.title,
        eventStartsAt: order.event.startsAt,
        eventVenue,
        ticketCount: order._count.tickets,
        qrCodeLocked: isQrCodeLocked(order.event),
        qrCodeReleaseAt: getQrCodeReleaseTime(order.event),
        tickets: order.tickets.map((ticket) => ({
          id: ticket.id,
          attendeeName: ticket.attendeeName,
          ticketTypeName: ticket.ticketType.name,
          shortCode: ticket.uuid.replace(/-/g, "").slice(0, 10).toUpperCase()
        }))
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao notificar a compra aprovada do pedido ${orderId}: ${message}`);
    }
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
