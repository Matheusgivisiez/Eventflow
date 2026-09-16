import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessMetricsService } from "../observability/business-metrics.service";

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    @Optional() private readonly metrics?: BusinessMetricsService
  ) {}

  async handle(provider: "mercado_pago" | "stripe" | "asaas" | "abacate_pay" | "infinite_pay", payload: Record<string, any>) {
    this.metrics?.increment("eventflow_webhooks_received_total", { provider });
    const eventName = this.extractEventName(payload);
    const providerEventId = this.extractProviderEventId(payload);
    const log = await this.upsertPaymentLog(provider, providerEventId, eventName, payload);

    if (log?.processedAt) {
      this.metrics?.increment("eventflow_webhooks_duplicates_total", { provider });
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
      this.metrics?.increment("eventflow_webhooks_unmatched_total", { provider });
      throw new NotFoundException("Pagamento do webhook nao encontrado.");
    }

    let status = this.mapStatus(provider, payload);
    if (provider === "infinite_pay") {
      const transactionId = this.extractTransactionId(provider, payload);
      const checkoutId = this.extractCheckoutId(provider, payload);
      await this.payments.recordProviderReferences(payment.id, payment.event.tenantId, {
        providerRef: transactionId ?? checkoutId,
        checkoutId,
        transactionId
      });
      const verified = await this.payments.reconcileProviderStatus(payment.id, payment.event.tenantId);
      if (verified) status = verified.status;
    }
    if (status === payment.status) {
      await this.markPaymentLogProcessed(log?.id, payment.id, payment.orderId, status);
      await this.audit.log({ action: `webhook.${provider}`, entity: "payment", entityId: payment.id, metadata: { status, providerEventId, event: eventName, unchanged: true } });
      this.metrics?.increment("eventflow_webhooks_processed_total", { provider, status });
      return { received: true, provider, status, payment };
    }

    const updated = await this.payments.updateStatus(payment.id, payment.event.tenantId, { status, providerRef });
    await this.markPaymentLogProcessed(log?.id, payment.id, payment.orderId, status);
    await this.audit.log({ action: `webhook.${provider}`, entity: "payment", entityId: payment.id, metadata: { status, providerEventId, event: eventName } });
    this.metrics?.increment("eventflow_webhooks_processed_total", { provider, status });

    // The purchase confirmation is emitted inside PaymentsService.updateStatus,
    // so reconciliation and simulated confirmations notify exactly like this
    // webhook does, and a replayed webhook cannot produce a second message.

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
      ? payload.data?.checkout?.externalId ?? payload.data?.checkout?.metadata?.orderId ?? payload.data?.metadata?.orderId ?? payload.data?.externalId ?? payload.metadata?.orderId ?? payload.externalId
      : provider === "infinite_pay"
        ? payload.order_nsu ?? payload.orderNsu
      : payload.orderId ?? payload.metadata?.orderId;
    return value ? String(value) : undefined;
  }

  private extractProviderRef(provider: string, payload: Record<string, any>): string {
    if (provider === "abacate_pay") {
      const value =
        payload.providerRef ??
        payload.data?.checkout?.id ??
        payload.data?.id ??
        payload.data?.checkoutId ??
        payload.data?.billId ??
        payload.data?.transactionId ??
        payload.payment?.id;
      return value ? String(value) : "";
    }

    return String(payload.providerRef ?? payload.transaction_nsu ?? payload.invoice_slug ?? payload.id ?? payload.data?.id ?? payload.payment?.id ?? "");
  }

  private extractTransactionId(provider: string, payload: Record<string, any>): string | undefined {
    if (provider !== "infinite_pay") return undefined;
    const value = payload.transaction_nsu ?? payload.transactionNsu;
    return value ? String(value) : undefined;
  }

  private extractCheckoutId(provider: string, payload: Record<string, any>): string | undefined {
    if (provider !== "infinite_pay") return undefined;
    const value = payload.invoice_slug ?? payload.slug;
    return value ? String(value) : undefined;
  }

  private mapStatus(provider: string, payload: Record<string, any>): PaymentStatus {
    if (provider === "infinite_pay") {
      return payload.paid === true ? PaymentStatus.PAID : PaymentStatus.PENDING;
    }
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
