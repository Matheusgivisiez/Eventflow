import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessMetricsService } from "../observability/business-metrics.service";

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    @Optional() private readonly metrics?: BusinessMetricsService
  ) {}

  async handle(provider: "mercado_pago" | "stripe" | "asaas" | "abacate_pay", payload: Record<string, any>) {
    this.metrics?.increment("eventhub_webhooks_received_total", { provider });
    const eventName = this.extractEventName(payload);
    const providerEventId = this.extractProviderEventId(payload);
    const log = await this.upsertPaymentLog(provider, providerEventId, eventName, payload);

    if (log?.processedAt) {
      this.metrics?.increment("eventhub_webhooks_duplicates_total", { provider });
      return { received: true, provider, duplicate: true };
    }

    const providerRef = this.extractProviderRef(provider, payload);
    const orderId = payload.orderId ? String(payload.orderId) : undefined;
    const externalOrderId = orderId ?? this.extractOrderId(provider, payload);
    const payment = await this.prisma.payment.findFirst({
      where: {
        provider,
        OR: [
          providerRef ? { providerRef } : undefined,
          providerRef ? { checkoutId: providerRef } : undefined,
          providerRef ? { transactionId: providerRef } : undefined,
          externalOrderId ? { orderId: externalOrderId } : undefined
        ].filter(Boolean) as any
      },
      include: { event: true, order: true }
    });
    if (!payment) {
      this.metrics?.increment("eventhub_webhooks_unmatched_total", { provider });
      throw new NotFoundException("Pagamento do webhook nao encontrado.");
    }

    const status = this.mapStatus(provider, payload);
    if (status === payment.status) {
      await this.markPaymentLogProcessed(log?.id, payment.id, payment.orderId, status);
      await this.audit.log({ action: `webhook.${provider}`, entity: "payment", entityId: payment.id, metadata: { status, providerEventId, event: eventName, unchanged: true } });
      this.metrics?.increment("eventhub_webhooks_processed_total", { provider, status });
      return { received: true, provider, status, payment };
    }

    const updated = await this.payments.updateStatus(payment.id, payment.event.tenantId, { status, providerRef });
    await this.markPaymentLogProcessed(log?.id, payment.id, payment.orderId, status);
    await this.audit.log({ action: `webhook.${provider}`, entity: "payment", entityId: payment.id, metadata: { status, providerEventId, event: eventName } });
    this.metrics?.increment("eventhub_webhooks_processed_total", { provider, status });

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

  private async upsertPaymentLog(provider: string, providerEventId: string | undefined, event: string, payload: Record<string, any>) {
    if (!providerEventId) {
      return this.prisma.paymentLog.create({
        data: { provider, event, payload }
      });
    }

    return this.prisma.paymentLog.upsert({
      where: { provider_providerEventId: { provider, providerEventId } },
      update: { event, payload },
      create: { provider, providerEventId, event, payload }
    });
  }

  private markPaymentLogProcessed(logId: string | undefined, paymentId: string, orderId: string, status: PaymentStatus) {
    if (!logId) return undefined;
    return this.prisma.paymentLog.update({
      where: { id: logId },
      data: { paymentId, orderId, status, processedAt: new Date() }
    });
  }

  private extractEventName(payload: Record<string, any>): string {
    return String(payload.event ?? payload.type ?? payload.status ?? payload.data?.status ?? "unknown");
  }

  private extractProviderEventId(payload: Record<string, any>): string | undefined {
    const value = payload.id ?? payload.eventId ?? payload.webhookId;
    return value ? String(value) : undefined;
  }

  private extractOrderId(provider: string, payload: Record<string, any>): string | undefined {
    const value = provider === "abacate_pay"
      ? payload.data?.metadata?.orderId ?? payload.data?.externalId ?? payload.metadata?.orderId ?? payload.externalId
      : payload.orderId ?? payload.metadata?.orderId;
    return value ? String(value) : undefined;
  }

  private extractProviderRef(provider: string, payload: Record<string, any>): string {
    if (provider === "abacate_pay") {
      const value =
        payload.providerRef ??
        payload.data?.id ??
        payload.data?.checkoutId ??
        payload.data?.billId ??
        payload.data?.transactionId ??
        payload.payment?.id;
      return value ? String(value) : "";
    }

    return String(payload.providerRef ?? payload.id ?? payload.data?.id ?? payload.payment?.id ?? "");
  }

  private mapStatus(provider: string, payload: Record<string, any>): PaymentStatus {
    const raw = String(payload.status ?? payload.event ?? payload.data?.status ?? payload.payment?.status ?? "").toLowerCase();
    // AbacatePay events: checkout.completed, transparent.completed
    if (["checkout.completed", "transparent.completed", "subscription.completed"].includes(raw)) return PaymentStatus.PAID;
    if (["checkout.refunded", "transparent.refunded"].includes(raw)) return PaymentStatus.REFUNDED;
    if (["checkout.disputed", "checkout.lost", "checkout.expired", "checkout.cancelled", "checkout.canceled", "transparent.disputed", "transparent.lost"].includes(raw)) return PaymentStatus.CANCELED;
    // Generic status words
    if (["paid", "approved", "confirmed", "received", "completed"].includes(raw)) return PaymentStatus.PAID;
    if (["refunded", "refunded_partially"].includes(raw)) return PaymentStatus.REFUNDED;
    if (["canceled", "cancelled", "failed", "rejected", "refused", "declined", "expired", "overdue"].includes(raw)) return PaymentStatus.CANCELED;
    return PaymentStatus.PENDING;
  }
}
