import { UnauthorizedException } from "@nestjs/common";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { CheckoutService } from "./checkout.service";

function createOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    eventId: "event-1",
    event: {
      id: "event-1",
      title: "EventHub Conf",
      startsAt: new Date("2026-09-12T18:00:00.000Z"),
      address: "Avenida Paulista, 1000"
    },
    buyerName: "Buyer",
    buyerEmail: "buyer@example.com",
    totalCents: 10800,
    status: PaymentStatus.PAID,
    orderAccessToken: "public-token",
    stockReservedAt: new Date(),
    createdAt: new Date("2026-08-15T12:00:00.000Z"),
    items: [
      {
        ticketTypeId: "ticket-type-1",
        ticketType: { name: "Inteira" },
        quantity: 1,
        totalCents: 10000
      }
    ],
    tickets: [
      {
        uuid: "ticket-uuid",
        attendeeName: "Buyer",
        qrCodeDataUrl: "data:image/png;base64,qr",
        status: "AVAILABLE"
      }
    ],
    payment: { method: PaymentMethod.PIX },
    ...overrides
  };
}

function createService() {
  const prisma = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    ticketType: {
      update: jest.fn()
    },
    payment: {
      update: jest.fn()
    },
    $transaction: jest.fn((callback) => callback(prisma))
  };
  const createCheckout = { execute: jest.fn() };
  const payments = { createProviderPreference: jest.fn() };
  const service = new CheckoutService(prisma as any, createCheckout as any, payments as any);
  return { service, prisma, createCheckout, payments };
}

describe("CheckoutService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks public order lookup without an access token", async () => {
    const { service, prisma } = createService();
    prisma.order.findUnique.mockResolvedValue(createOrder());

    await expect(service.getOrderStatus("order-1")).rejects.toThrow(UnauthorizedException);
  });

  it("blocks public order lookup with an invalid access token", async () => {
    const { service, prisma } = createService();
    prisma.order.findUnique.mockResolvedValue(createOrder());

    await expect(service.getOrderStatus("order-1", "wrong-token")).rejects.toThrow(UnauthorizedException);
  });

  it("returns public order details with a valid access token", async () => {
    const { service, prisma } = createService();
    prisma.order.findUnique.mockResolvedValue(createOrder());

    const result = await service.getOrderStatus("order-1", "public-token");

    expect(result.id).toBe("order-1");
    expect(result.buyerEmail).toBe("buyer@example.com");
    expect(result.tickets).toEqual([
      {
        uuid: "ticket-uuid",
        attendeeName: "Buyer",
        qrCodeDataUrl: "data:image/png;base64,qr",
        status: "AVAILABLE"
      }
    ]);
  });

  it("returns the order access token after checkout creation", async () => {
    const { service, createCheckout, payments } = createService();
    createCheckout.execute.mockResolvedValue(createOrder({ status: PaymentStatus.PENDING }));
    payments.createProviderPreference.mockResolvedValue({ checkoutUrl: "https://pay.example/checkout" });

    const result = await service.create("eventhub-conf", {} as any);

    expect(result.orderAccessToken).toBe("public-token");
    expect(result.checkoutUrl).toBe("https://pay.example/checkout");
  });

  it("cancels the order and releases reserved stock when provider checkout creation fails", async () => {
    const { service, prisma, createCheckout, payments } = createService();
    createCheckout.execute.mockResolvedValue(createOrder({ status: PaymentStatus.PENDING }));
    payments.createProviderPreference.mockRejectedValue(new Error("provider unavailable"));
    prisma.order.findUnique.mockResolvedValue(createOrder({ status: PaymentStatus.PENDING }));

    await expect(service.create("eventhub-conf", {} as any)).rejects.toThrow("provider unavailable");

    expect(prisma.ticketType.update).toHaveBeenCalledWith({
      where: { id: "ticket-type-1" },
      data: { sold: { decrement: 1 } }
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: PaymentStatus.CANCELED, stockReservedAt: null }
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      data: { status: PaymentStatus.CANCELED, canceledAt: expect.any(Date) }
    });
  });
});
