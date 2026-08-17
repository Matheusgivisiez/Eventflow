import { NotFoundException } from "@nestjs/common";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import QRCode from "qrcode";
import { PaymentsService } from "./payments.service";

jest.mock("qrcode", () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,ticket-qr") }
}));

function createService() {
  const prisma = {
    order: {
      findUnique: jest.fn()
    },
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    ticket: {
      count: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn()
    },
    ticketType: {
      updateMany: jest.fn(),
      update: jest.fn()
    },
    ledgerEntry: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    seat: {
      updateMany: jest.fn()
    },
    seatReservation: {
      updateMany: jest.fn()
    },
    $transaction: jest.fn((callback) => callback(prisma))
  };
  const abacatePay = {
    createCheckout: jest.fn()
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === "APP_URL") return "https://app.example";
      if (key === "QR_CODE_SECRET") return "test-qrcode-secret";
      return undefined;
    })
  };
  const service = new PaymentsService(prisma as any, abacatePay as any, config as any);
  return { service, prisma, abacatePay };
}

function createPayment(overrides: Record<string, any> = {}) {
  return {
    id: "payment-1",
    orderId: "order-1",
    eventId: "event-1",
    method: PaymentMethod.PIX,
    status: PaymentStatus.PENDING,
    providerRef: null,
    amountCents: 10800,
    event: { id: "event-1", tenantId: "tenant-1", title: "Event Flow Conf" },
    order: {
      id: "order-1",
      userId: "user-1",
      eventId: "event-1",
      buyerName: "Buyer",
      buyerEmail: "buyer@example.com",
      feeCents: 800,
      stockReservedAt: new Date("2026-08-15T12:00:00.000Z"),
      tickets: [],
      items: [
        {
          ticketTypeId: "ticket-type-1",
          quantity: 2,
          seatIds: [],
          ticketType: {
            id: "ticket-type-1",
            name: "Inteira",
            quantity: 10,
            sold: 2
          }
        }
      ]
    },
    ...overrides
  };
}

describe("PaymentsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns buyers to their tickets and includes the order access token in the completion URL", async () => {
    const { service, prisma, abacatePay } = createService();
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      totalCents: 10800,
      buyerEmail: "buyer@example.com",
      buyerName: "Buyer",
      buyerDocument: "12345678900",
      buyerPhone: "11999999999",
      orderAccessToken: "public-token",
      event: { tenantId: "tenant-1", title: "Event Flow Conf" },
      payment: { method: PaymentMethod.PIX, status: PaymentStatus.PENDING }
    });
    abacatePay.createCheckout.mockResolvedValue({
      provider: "abacate_pay",
      providerRef: "checkout-1",
      checkoutId: "checkout-1",
      checkoutUrl: "https://pay.example/checkout"
    });

    await service.createProviderPreference("order-1");

    expect(abacatePay.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      returnUrl: "https://app.example/me/ingressos",
      completionUrl: "https://app.example/checkout/success?orderId=order-1&accessToken=public-token&status=paid"
    }));
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { orderId: "order-1" }
    }));
  });

  it("blocks provider preference creation for orders from another tenant", async () => {
    const { service, prisma, abacatePay } = createService();
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      totalCents: 10800,
      buyerEmail: "buyer@example.com",
      buyerName: "Buyer",
      orderAccessToken: "public-token",
      event: { tenantId: "tenant-2", title: "Event Flow Conf" },
      payment: { method: PaymentMethod.PIX, status: PaymentStatus.PENDING }
    });

    await expect(service.createProviderPreference("order-1", "tenant-1")).rejects.toThrow(NotFoundException);
    expect(abacatePay.createCheckout).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("allows provider preference creation for orders from the same tenant", async () => {
    const { service, prisma, abacatePay } = createService();
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      totalCents: 10800,
      buyerEmail: "buyer@example.com",
      buyerName: "Buyer",
      orderAccessToken: "public-token",
      event: { tenantId: "tenant-1", title: "Event Flow Conf" },
      payment: { method: PaymentMethod.PIX, status: PaymentStatus.PENDING }
    });
    abacatePay.createCheckout.mockResolvedValue({
      provider: "abacate_pay",
      providerRef: "checkout-1",
      checkoutId: "checkout-1",
      checkoutUrl: "https://pay.example/checkout"
    });

    await service.createProviderPreference("order-1", "tenant-1");

    expect(abacatePay.createCheckout).toHaveBeenCalled();
    expect(prisma.payment.update).toHaveBeenCalled();
  });

  it("marks a pending payment as paid, emits tickets, and creates one ledger entry", async () => {
    const { service, prisma } = createService();
    prisma.payment.findFirst.mockResolvedValue(createPayment());
    prisma.payment.findUnique.mockResolvedValue({ id: "payment-1", status: PaymentStatus.PAID });
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ledgerEntry.findFirst.mockResolvedValue(null);

    const result = await service.updateStatus("payment-1", "tenant-1", {
      status: PaymentStatus.PAID,
      providerRef: "checkout-1"
    });

    expect(result).toEqual({ id: "payment-1", status: PaymentStatus.PAID });
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payment-1" },
      data: expect.objectContaining({
        status: PaymentStatus.PAID,
        providerRef: "checkout-1",
        order: { update: { status: PaymentStatus.PAID } }
      })
    }));
    expect(prisma.ticket.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          orderId: "order-1",
          eventId: "event-1",
          ticketTypeId: "ticket-type-1",
          attendeeEmail: "buyer@example.com",
          qrCodeDataUrl: "data:image/png;base64,ticket-qr"
        })
      ])
    });
    expect(prisma.ticket.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        description: "Venda Event Flow Conf",
        amountCents: 10000,
        feeCents: 800,
        reference: "payment-1"
      }
    });
    expect(prisma.ticketType.updateMany).not.toHaveBeenCalled();
    expect(QRCode.toDataURL).toHaveBeenCalledTimes(2);
  });

  it("does not emit duplicate tickets or duplicate ledger when paid fulfillment is retried", async () => {
    const { service, prisma } = createService();
    prisma.payment.findFirst.mockResolvedValue(createPayment({ status: PaymentStatus.PAID }));
    prisma.payment.findUnique.mockResolvedValue({ id: "payment-1", status: PaymentStatus.PAID });
    prisma.ticket.count.mockResolvedValue(2);
    prisma.ledgerEntry.findFirst.mockResolvedValue({ id: "ledger-1" });

    await service.updateStatus("payment-1", "tenant-1", { status: PaymentStatus.PAID });

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.ticket.createMany).not.toHaveBeenCalled();
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it("atomically increments stock for legacy paid orders without prior reservation", async () => {
    const { service, prisma } = createService();
    prisma.payment.findFirst.mockResolvedValue(createPayment({
      order: {
        ...createPayment().order,
        stockReservedAt: null
      }
    }));
    prisma.payment.findUnique.mockResolvedValue({ id: "payment-1", status: PaymentStatus.PAID });
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ledgerEntry.findFirst.mockResolvedValue(null);
    prisma.ticketType.updateMany.mockResolvedValue({ count: 1 });

    await service.updateStatus("payment-1", "tenant-1", { status: PaymentStatus.PAID });

    expect(prisma.ticketType.updateMany).toHaveBeenCalledWith({
      where: {
        id: "ticket-type-1",
        sold: { lte: 8 }
      },
      data: { sold: { increment: 2 } }
    });
  });
});
