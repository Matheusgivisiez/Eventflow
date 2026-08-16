import { NotFoundException } from "@nestjs/common";
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
    updateStatus: jest.fn()
  };
  const notifications = {
    sendPurchaseApproved: jest.fn()
  };
  const audit = {
    log: jest.fn()
  };
  const service = new WebhooksService(prisma as any, payments as any, notifications as any, audit as any);
  return { service, prisma, payments, notifications, audit };
}

describe("WebhooksService paid payment handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("processes a paid AbacatePay webhook, updates payment status, marks log, audits, and notifies buyer", async () => {
    const { service, prisma, payments, notifications, audit } = createService();
    prisma.paymentLog.upsert.mockResolvedValue({ id: "log-1", processedAt: null });
    prisma.payment.findFirst.mockResolvedValue(createPayment());
    payments.updateStatus.mockResolvedValue({ id: "payment-1", status: PaymentStatus.PAID });
    prisma.paymentLog.update.mockResolvedValue({});

    const result = await service.handle("abacate_pay", {
      id: "webhook-1",
      event: "checkout.completed",
      data: {
        id: "checkout-1",
        metadata: { orderId: "order-1" }
      }
    });

    expect(result).toEqual({
      received: true,
      provider: "abacate_pay",
      status: PaymentStatus.PAID,
      payment: { id: "payment-1", status: PaymentStatus.PAID }
    });
    expect(payments.updateStatus).toHaveBeenCalledWith("payment-1", "tenant-1", {
      status: PaymentStatus.PAID,
      providerRef: "checkout-1"
    });
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
    expect(notifications.sendPurchaseApproved).toHaveBeenCalledWith({
      email: "buyer@example.com",
      phone: "11999999999",
      orderId: "order-1",
      eventTitle: "Event Flow Conf"
    });
  });

  it("does not reprocess duplicate paid webhooks when the payment log is already processed", async () => {
    const { service, prisma, payments, notifications, audit } = createService();
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
    expect(notifications.sendPurchaseApproved).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("marks unchanged paid webhook logs without emitting duplicate notifications", async () => {
    const { service, prisma, payments, notifications, audit } = createService();
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
    expect(notifications.sendPurchaseApproved).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ unchanged: true })
    }));
  });

  it("fails without leaking payment data when webhook cannot be matched to a payment", async () => {
    const { service, prisma, payments, notifications } = createService();
    prisma.paymentLog.upsert.mockResolvedValue({ id: "log-1", processedAt: null });
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(service.handle("abacate_pay", {
      id: "webhook-1",
      event: "checkout.completed",
      data: { id: "unknown-checkout" }
    })).rejects.toThrow(NotFoundException);

    expect(payments.updateStatus).not.toHaveBeenCalled();
    expect(notifications.sendPurchaseApproved).not.toHaveBeenCalled();
  });
});
