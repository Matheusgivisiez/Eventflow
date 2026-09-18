import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { WebhooksService } from "./webhooks.service";

function createPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "payment-1",
    orderId: "order-1",
    provider: "abacate_pay",
    providerRef: "checkout-1",
    checkoutId: "checkout-1",
    transactionId: null,
    status: PaymentStatus.PENDING,
    event: {
      id: "event-1",
      tenantId: "tenant-1",
      title: "Event Flow Conf"
    },
    order: {
      id: "order-1",
      buyerEmail: "buyer@example.com",
      buyerPhone: "11999999999"
    },
    ...overrides
  };
}

function createService() {
  const prisma = {
    paymentLog: {
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn()
    },
    payment: {
      findFirst: jest.fn()
    }
  };
  const payments = {
    updateStatus: jest.fn(),
    recordProviderReferences: jest.fn(),
    reconcileProviderStatus: jest.fn()
  };
  const audit = {
    log: jest.fn()
  };
  const service = new WebhooksService(prisma as any, payments as any, audit as any);
  return { service, prisma, payments, audit };
}

describe("WebhooksService paid payment handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("processes a paid AbacatePay webhook, updates payment status, marks the log and audits", async () => {
    const { service, prisma, payments, audit } = createService();
    prisma.paymentLog.upsert.mockResolvedValue({ id: "log-1", processedAt: null });
    prisma.payment.findFirst.mockResolvedValue(createPayment());
    payments.reconcileProviderStatus.mockResolvedValue({ id: "payment-1", status: PaymentStatus.PAID });
    prisma.paymentLog.update.mockResolvedValue({});

    const result = await service.handle("abacate_pay", {
      id: "webhook-1",
      event: "checkout.completed",
      data: {
        checkout: {
          id: "checkout-1",
          externalId: "order-1",
          status: "PAID"
        }
      }
    });

    expect(result).toEqual({
      received: true,
      provider: "abacate_pay",
      status: PaymentStatus.PAID,
      payment: { id: "payment-1", status: PaymentStatus.PAID }
    });
    // O valor e o status vem do provedor, nunca do corpo do webhook.
    expect(payments.reconcileProviderStatus).toHaveBeenCalledWith("payment-1", "tenant-1");
    expect(payments.updateStatus).not.toHaveBeenCalled();
    expect(prisma.paymentLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: {
        paymentId: "payment-1",
        orderId: "order-1",
        status: PaymentStatus.PAID,
        processedAt: expect.any(Date)
      }
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: "webhook.abacate_pay",
      entity: "payment",
      entityId: "payment-1",
      metadata: expect.objectContaining({ status: PaymentStatus.PAID })
    }));
  });

  it("delegates the purchase confirmation to the payment funnel instead of notifying directly", async () => {
    const { service, prisma, payments } = createService();
    prisma.paymentLog.upsert.mockResolvedValue({ id: "log-1", processedAt: null });
    prisma.payment.findFirst.mockResolvedValue(createPayment());
    prisma.paymentLog.update.mockResolvedValue({});
    payments.reconcileProviderStatus.mockResolvedValue({ id: "payment-1", status: PaymentStatus.PAID });

    await service.handle("abacate_pay", {
      id: "webhook-1",
      event: "checkout.completed",
      data: { id: "checkout-1" }
    });

    // The webhook must not own the message: reconciliation and simulated
    // confirmations reach PaymentsService.updateStatus by other routes and
    // have to produce exactly the same notification.
    // A confirmacao continua nascendo dentro do PaymentsService — agora pela
    // reconciliacao, que so marca PAID depois de conferir valor no provedor.
    expect(payments.reconcileProviderStatus).toHaveBeenCalledWith("payment-1", expect.anything());
    expect(Object.keys(service as unknown as Record<string, unknown>)).not.toContain("notifications");
  });

  it("does not reprocess duplicate paid webhooks when the payment log is already processed", async () => {
    const { service, prisma, payments, audit } = createService();
    prisma.paymentLog.upsert.mockResolvedValue({ id: "log-1", processedAt: new Date() });

    const result = await service.handle("abacate_pay", {
      id: "webhook-1",
      event: "checkout.completed",
      data: { id: "checkout-1" }
    });

    expect(result).toEqual({ received: true, provider: "abacate_pay", duplicate: true });
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    expect(payments.updateStatus).not.toHaveBeenCalled();
    expect(prisma.paymentLog.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("marks unchanged paid webhook logs without emitting duplicate notifications", async () => {
    const { service, prisma, payments, audit } = createService();
    prisma.paymentLog.upsert.mockResolvedValue({ id: "log-1", processedAt: null });
    prisma.payment.findFirst.mockResolvedValue(createPayment({ status: PaymentStatus.PAID }));
    prisma.paymentLog.update.mockResolvedValue({});

    const result = await service.handle("abacate_pay", {
      id: "webhook-2",
      event: "checkout.completed",
      data: { id: "checkout-1" }
    });

    expect(result.status).toBe(PaymentStatus.PAID);
    expect(payments.updateStatus).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ unchanged: true })
    }));
  });

  it("recusa o webhook e mantem o log pendente quando o provedor nao confirma o pagamento", async () => {
    const { service, prisma, payments, audit } = createService();
    prisma.paymentLog.upsert.mockResolvedValue({ id: "log-1", processedAt: null });
    prisma.payment.findFirst.mockResolvedValue(createPayment());
    // Provedor ainda diz PENDING (ou valor divergente, que cai no mesmo lugar).
    payments.reconcileProviderStatus.mockResolvedValue({ id: "payment-1", status: PaymentStatus.PENDING });

    await expect(service.handle("abacate_pay", {
      id: "webhook-3",
      event: "checkout.completed",
      data: { checkout: { id: "checkout-1", externalId: "order-1", status: "PAID" } }
    })).rejects.toThrow(ServiceUnavailableException);

    // Sem processedAt, o provedor reenvia o webhook em vez de perder a venda.
    expect(prisma.paymentLog.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("recusa o webhook quando a consulta ao provedor falha", async () => {
    const { service, prisma, payments } = createService();
    prisma.paymentLog.upsert.mockResolvedValue({ id: "log-1", processedAt: null });
    prisma.payment.findFirst.mockResolvedValue(createPayment());
    payments.reconcileProviderStatus.mockRejectedValue(new Error("provider offline"));

    await expect(service.handle("abacate_pay", {
      id: "webhook-4",
      event: "checkout.completed",
      data: { checkout: { id: "checkout-1", status: "PAID" } }
    })).rejects.toThrow(ServiceUnavailableException);

    expect(prisma.paymentLog.update).not.toHaveBeenCalled();
  });

  it("fails without leaking payment data when webhook cannot be matched to a payment", async () => {
    const { service, prisma, payments } = createService();
    prisma.paymentLog.upsert.mockResolvedValue({ id: "log-1", processedAt: null });
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(service.handle("abacate_pay", {
      id: "webhook-1",
      event: "checkout.completed",
      data: { id: "unknown-checkout" }
    })).rejects.toThrow(NotFoundException);

    expect(payments.updateStatus).not.toHaveBeenCalled();
  });
});
