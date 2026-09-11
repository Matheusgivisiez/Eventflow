import { BadRequestException } from "@nestjs/common";
import {
  EventFormat,
  EventStatus,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";
import { CreateCheckoutUseCase } from "./create-checkout.use-case";

function createEvent(sold = 0) {
  return {
    id: "event-1",
    tenantId: "tenant-1",
    ownerId: "owner-1",
    title: "Event Flow Conf",
    slug: "eventflow-conf",
    description: "Conference",
    category: "Tecnologia",
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    endsAt: null,
    format: EventFormat.IN_PERSON,
    status: EventStatus.PUBLISHED,
    feeAbsorbedByOrganizer: false,
    limitPerCpf: null,
    salesStartsAt: new Date(Date.now() - 1000 * 60 * 60),
    salesEndsAt: new Date(Date.now() + 1000 * 60 * 60),
    ticketTypes: [
      {
        id: "ticket-type-1",
        eventId: "event-1",
        name: "Ultimo ingresso",
        description: null,
        quantity: 1,
        sold,
        priceCents: 10000,
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60),
        limitPerBuy: 5,
        isActive: true,
      },
    ],
  };
}

function createDto() {
  return {
    buyerName: "Buyer",
    buyerEmail: "buyer@example.com",
    buyerDocument: "12201513600",
    buyerPhone: "11999999999",
    paymentMethod: PaymentMethod.PIX,
    items: [{ ticketTypeId: "ticket-type-1", quantity: 1 }],
  };
}

function createService() {
  let sold = 0;
  const orders: any[] = [];
  const tx = {
    event: {
      findFirst: jest.fn(async () => createEvent(0)),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async ({ data }) => {
        const order = {
          id: `order-${orders.length + 1}`,
          ...data,
          items: data.items.create,
          payment: data.payment.create,
        };
        orders.push(order);
        return order;
      }),
    },
    coupon: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    affiliateLink: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    promoterLink: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    affiliateCommission: {
      create: jest.fn(),
    },
    ticketType: {
      updateMany: jest.fn(async ({ where, data }) => {
        const requestedQty = data.sold.increment;
        const maxSoldBeforeReservation = where.sold.lte;
        if (sold <= maxSoldBeforeReservation) {
          sold += requestedQty;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
  };
  const prisma = {
    event: tx.event,
    order: tx.order,
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const coupons = {
    calculateDiscount: jest.fn().mockReturnValue(0),
  };
  const service = new CreateCheckoutUseCase(prisma as any, coupons as any);

  return { service, tx, orders, getSold: () => sold };
}

describe("CreateCheckoutUseCase stock reservation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reserves the last ticket atomically and blocks the next competing checkout", async () => {
    const { service, tx, orders, getSold } = createService();

    const firstOrder = await service.execute(
      "eventflow-conf",
      createDto() as any,
    );
    await expect(
      service.execute("eventflow-conf", createDto() as any),
    ).rejects.toThrow(BadRequestException);

    expect(firstOrder.status).toBe(PaymentStatus.PENDING);
    expect(firstOrder.stockReservedAt).toBeInstanceOf(Date);
    expect(firstOrder.orderAccessToken).toEqual(expect.any(String));
    expect(firstOrder.orderAccessToken).toHaveLength(43);
    expect(tx.ticketType.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.order.create).toHaveBeenCalledTimes(1);
    expect(orders).toHaveLength(1);
    expect(getSold()).toBe(1);
  });

  it("does not create an order when atomic stock reservation fails", async () => {
    const { service, tx, orders } = createService();

    await service.execute("eventflow-conf", createDto() as any);
    await expect(
      service.execute("eventflow-conf", createDto() as any),
    ).rejects.toThrow("Nao ha ingressos suficientes");

    expect(tx.order.create).toHaveBeenCalledTimes(1);
    expect(orders).toHaveLength(1);
  });

  it("links an authenticated checkout to the purchaser account", async () => {
    const { service, tx } = createService();

    await service.execute(
      "eventflow-conf",
      createDto() as any,
      {
        id: "buyer-user-1",
        tenantId: null,
        email: "account@example.com",
        role: "CUSTOMER",
      } as any,
    );

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "buyer-user-1" }),
      }),
    );
  });

  it("atomically reserves the final coupon use before creating the order", async () => {
    const { service, tx } = createService();
    tx.coupon.findUnique.mockResolvedValue({
      id: "coupon-1", tenantId: "tenant-1", isActive: true, maxUses: 1, usedCount: 0,
      validFrom: new Date(Date.now() - 60_000), validUntil: new Date(Date.now() + 60_000),
      discountPercent: 10, discountFixedCents: 0
    });

    await service.execute("eventflow-conf", { ...createDto(), couponCode: "FIRST" } as any);

    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "coupon-1", usedCount: { lt: 1 } },
      data: { usedCount: { increment: 1 } }
    });
  });

  it("rejects checkout when another request consumed the final coupon use", async () => {
    const { service, tx, orders } = createService();
    tx.coupon.findUnique.mockResolvedValue({
      id: "coupon-1", tenantId: "tenant-1", isActive: true, maxUses: 1, usedCount: 0,
      validFrom: new Date(Date.now() - 60_000), validUntil: new Date(Date.now() + 60_000),
      discountPercent: 10, discountFixedCents: 0
    });
    tx.coupon.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.execute("eventflow-conf", { ...createDto(), couponCode: "FIRST" } as any)).rejects.toThrow("Cupom esgotado");
    expect(orders).toHaveLength(0);
  });
});

describe("CreateCheckoutUseCase with CHECKOUT_HOT_ROW_WRITES_LAST", () => {
  const originalFlag = process.env.CHECKOUT_HOT_ROW_WRITES_LAST;
  const originalPerf = process.env.PERF_DIAGNOSTICS;

  beforeEach(() => {
    process.env.CHECKOUT_HOT_ROW_WRITES_LAST = "true";
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.CHECKOUT_HOT_ROW_WRITES_LAST;
    else process.env.CHECKOUT_HOT_ROW_WRITES_LAST = originalFlag;
    if (originalPerf === undefined) delete process.env.PERF_DIAGNOSTICS;
    else process.env.PERF_DIAGNOSTICS = originalPerf;
  });

  it("reserves stock as the last write of the transaction, after the order is created", async () => {
    const { service, tx, getSold } = createService();

    await service.execute("eventflow-conf", createDto() as any);

    const orderCreatedAt = tx.order.create.mock.invocationCallOrder[0];
    const stockReservedAt = tx.ticketType.updateMany.mock.invocationCallOrder[0];
    expect(stockReservedAt).toBeGreaterThan(orderCreatedAt);
    expect(getSold()).toBe(1);
  });

  it("still rejects the competing checkout for the last ticket (its order is rolled back with the transaction)", async () => {
    const { service, getSold } = createService();

    await service.execute("eventflow-conf", createDto() as any);
    await expect(
      service.execute("eventflow-conf", createDto() as any),
    ).rejects.toThrow("Nao ha ingressos suficientes");

    expect(getSold()).toBe(1);
  });

  it("defers the coupon reservation until after the order is created and still enforces the limit", async () => {
    const { service, tx } = createService();
    tx.coupon.findUnique.mockResolvedValue({
      id: "coupon-1", tenantId: "tenant-1", isActive: true, maxUses: 1, usedCount: 0,
      validFrom: new Date(Date.now() - 60_000), validUntil: new Date(Date.now() + 60_000),
      discountPercent: 10, discountFixedCents: 0
    });

    await service.execute("eventflow-conf", { ...createDto(), couponCode: "FIRST" } as any);
    expect(tx.coupon.updateMany.mock.invocationCallOrder[0]).toBeGreaterThan(tx.order.create.mock.invocationCallOrder[0]);
    expect(tx.ticketType.updateMany.mock.invocationCallOrder[0]).toBeGreaterThan(tx.coupon.updateMany.mock.invocationCallOrder[0]);

    tx.coupon.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.execute("eventflow-conf", { ...createDto(), couponCode: "FIRST" } as any),
    ).rejects.toThrow("Cupom esgotado");
  });

  it("works with perf diagnostics enabled", async () => {
    process.env.PERF_DIAGNOSTICS = "true";
    const { service } = createService();

    const order = await service.execute("eventflow-conf", createDto() as any);

    expect(order.id).toEqual(expect.any(String));
  });
});
