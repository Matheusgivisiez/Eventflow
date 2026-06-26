import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  async handle(provider: "mercado_pago" | "stripe" | "asaas", payload: Record<string, any>) {
    const providerRef = String(payload.providerRef ?? payload.id ?? payload.data?.id ?? payload.payment?.id ?? "");
    const orderId = payload.orderId ? String(payload.orderId) : undefined;
    const payment = await this.prisma.payment.findFirst({
      where: {
        provider,
        OR: [{ providerRef }, orderId ? { orderId } : undefined].filter(Boolean) as any
      },
      include: { event: true, order: true }
    });
    if (!payment) {
      throw new NotFoundException("Pagamento do webhook nao encontrado.");
    }

    const status = this.mapStatus(provider, payload);
    const updated = await this.payments.updateStatus(payment.id, payment.event.tenantId, { status, providerRef });
    await this.audit.log({ action: `webhook.${provider}`, entity: "payment", entityId: payment.id, metadata: { status, payload } });

    if (status === PaymentStatus.PAID) {
      await this.notifications.sendPurchaseApproved({
        email: payment.order.buyerEmail,
        phone: payment.order.buyerPhone ?? undefined,
        orderId: payment.orderId,
        eventTitle: payment.event.title
      });
    }

    return { received: true, provider, status, payment: updated };
  }

  private mapStatus(provider: string, payload: Record<string, any>): PaymentStatus {
    const raw = String(payload.status ?? payload.data?.status ?? payload.payment?.status ?? "").toLowerCase();
    if (["paid", "approved", "confirmed", "received"].includes(raw)) return PaymentStatus.PAID;
    if (["refunded", "refunded_partially"].includes(raw)) return PaymentStatus.REFUNDED;
    if (["canceled", "cancelled", "failed", "rejected", "overdue"].includes(raw)) return PaymentStatus.CANCELED;
    return PaymentStatus.PENDING;
  }
}
