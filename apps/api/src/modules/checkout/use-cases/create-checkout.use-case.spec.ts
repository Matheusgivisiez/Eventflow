import { BadRequestException, NotFoundException } from "@nestjs/common";
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
        name: "Último ingresso",
        description: null,
        quantity: 1,
        sold,
        priceCents: 10000,
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60),
        salesEndQuantity: null,
        limitPerBuy: 5,
        isActive: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60),
      },
    ],
  };
}

function createDto() {
  return {
    buyerName: "Buyer Test",
    buyerEmail: "buyer@example.com",
    buyerDocument: "12201513600",
    buyerPhone: "11999999999",
    paymentMethod: PaymentMethod.PIX,
    items: [{ ticketTypeId: "ticket-type-1", quantity: 1 }],
  };
}

function createService(eventFactory: () => ReturnType<typeof createEvent> = () => createEvent(0)) {
  let sold = 0;
  const orders: any[] = [];
  const tx = {
    event: {
      findFirst: jest.fn(async () => eventFactory()),
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
    // Leitura pós-COMMIT que marca os lotes abertos (markOpenedLots).
    ticketType: {
      findMany: jest.fn(async () => eventFactory().ticketTypes as any[]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const coupons = {
    calculateDiscount: jest.fn().mockReturnValue(0),
  };
  const service = new CreateCheckoutUseCase(prisma as any, coupons as any);

  return { service, tx, prisma, orders, getSold: () => sold };
}

describe("CreateCheckoutUseCase stock reservation (legacy write order, CHECKOUT_HOT_ROW_WRITES_LAST=false)", () => {
  const originalFlag = process.env.CHECKOUT_HOT_ROW_WRITES_LAST;

  beforeEach(() => {
    process.env.CHECKOUT_HOT_ROW_WRITES_LAST = "false";
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.CHECKOUT_HOT_ROW_WRITES_LAST;
    else process.env.CHECKOUT_HOT_ROW_WRITES_LAST = originalFlag;
  });

  it.each(["ba", "Sarah", "  Maria  ", "Ana B"])(
    "rejects a buyer name without surname (%p) before creating the order",
    async (buyerName) => {
      const { service, tx } = createService();

      await expect(
        service.execute("eventflow-conf", { ...createDto(), buyerName } as any),
      ).rejects.toThrow("Informe nome e sobrenome.");
      expect(tx.order.create).not.toHaveBeenCalled();
    },
  );

  it("stores the buyer name trimmed and with single spaces", async () => {
    const { service, tx } = createService();

    await service.execute("eventflow-conf", { ...createDto(), buyerName: "  Bárbara   dos Santos " } as any);

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ buyerName: "Bárbara dos Santos" }) }),
    );
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
    ).rejects.toThrow("Não há ingressos suficientes");

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
      id: "coupon-1", tenantId: "tenant-1", ownerId: "owner-1", isActive: true, maxUses: 1, usedCount: 0,
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
      id: "coupon-1", tenantId: "tenant-1", ownerId: "owner-1", isActive: true, maxUses: 1, usedCount: 0,
      validFrom: new Date(Date.now() - 60_000), validUntil: new Date(Date.now() + 60_000),
      discountPercent: 10, discountFixedCents: 0
    });
    tx.coupon.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.execute("eventflow-conf", { ...createDto(), couponCode: "FIRST" } as any)).rejects.toThrow("Cupom esgotado");
    expect(orders).toHaveLength(0);
  });

  it("rejects a coupon restricted to a different event", async () => {
    const { service, tx, orders } = createService();
    tx.coupon.findUnique.mockResolvedValue({
      id: "coupon-1", tenantId: "tenant-1", ownerId: "owner-1", isActive: true, maxUses: 1, usedCount: 0,
      validFrom: new Date(Date.now() - 60_000), validUntil: new Date(Date.now() + 60_000),
      discountPercent: 10, discountFixedCents: 0,
      events: [{ eventId: "other-event" }]
    });

    await expect(
      service.execute("eventflow-conf", { ...createDto(), couponCode: "FIRST" } as any)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(orders).toHaveLength(0);
  });

  it("rejects a coupon from another event owner in the same organization", async () => {
    const { service, tx, orders } = createService();
    tx.coupon.findUnique.mockResolvedValue({
      id: "coupon-1", tenantId: "tenant-1", ownerId: "owner-2", isActive: true,
      maxUses: 0, usedCount: 0, events: [],
      validFrom: new Date(Date.now() - 60_000), validUntil: new Date(Date.now() + 60_000),
      discountPercent: 10, discountFixedCents: 0
    });
    await expect(service.execute("eventflow-conf", { ...createDto(), couponCode: "FIRST" } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(orders).toHaveLength(0);
  });

  it("accepts a coupon restricted to this event", async () => {
    const { service, tx } = createService();
    tx.coupon.findUnique.mockResolvedValue({
      id: "coupon-1", tenantId: "tenant-1", ownerId: "owner-1", isActive: true, maxUses: 1, usedCount: 0,
      validFrom: new Date(Date.now() - 60_000), validUntil: new Date(Date.now() + 60_000),
      discountPercent: 10, discountFixedCents: 0,
      events: [{ eventId: "event-1" }]
    });

    await expect(
      service.execute("eventflow-conf", { ...createDto(), couponCode: "FIRST" } as any)
    ).resolves.toBeDefined();
  });
});

describe("CreateCheckoutUseCase default write order (hot-row writes last)", () => {
  const originalFlag = process.env.CHECKOUT_HOT_ROW_WRITES_LAST;
  const originalPerf = process.env.PERF_DIAGNOSTICS;

  beforeEach(() => {
    delete process.env.CHECKOUT_HOT_ROW_WRITES_LAST;
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
    ).rejects.toThrow("Não há ingressos suficientes");

    expect(getSold()).toBe(1);
  });

  it("rejects checkout for a future lot while the first lot is still available", async () => {
    const event = createEvent(50);
    event.ticketTypes = [
      {
        ...event.ticketTypes[0],
        id: "ticket-type-1",
        name: "Lote 1",
        quantity: 100,
        sold: 50,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
      },
      {
        ...event.ticketTypes[0],
        id: "ticket-type-2",
        name: "Lote 2",
        quantity: 100,
        sold: 0,
        priceCents: 15000,
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
      },
    ];
    const { service } = createService(() => event);

    await expect(
      service.execute("eventflow-conf", {
        ...createDto(),
        items: [{ ticketTypeId: "ticket-type-2", quantity: 1 }],
      } as any),
    ).rejects.toThrow("Lote de ingresso indisponível");
  });

  it("keeps the first lot closed until its scheduled start", async () => {
    const event = createEvent(0);
    event.ticketTypes = [
      {
        ...event.ticketTypes[0],
        name: "Promocional",
        quantity: 50,
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
      },
    ];
    const { service, tx, getSold } = createService(() => event);

    await expect(
      service.execute("eventflow-conf", createDto() as any),
    ).rejects.toThrow("As vendas deste lote ainda não começaram.");

    expect(tx.order.create).not.toHaveBeenCalled();
    expect(getSold()).toBe(0);
  });

  it("opens the first lot once its scheduled start has passed", async () => {
    const event = createEvent(0);
    event.ticketTypes = [
      {
        ...event.ticketTypes[0],
        name: "Promocional",
        quantity: 50,
        startsAt: new Date(Date.now() - 1_000),
        endsAt: new Date(Date.now() + 120_000),
      },
    ];
    const { service, getSold } = createService(() => event);

    await service.execute("eventflow-conf", createDto() as any);

    expect(getSold()).toBe(1);
  });

  it("opens the second lot before its own start when the first lot sells out", async () => {
    const event = createEvent(0);
    event.ticketTypes = [
      {
        ...event.ticketTypes[0],
        id: "ticket-type-1",
        name: "Lote 1",
        quantity: 50,
        sold: 50,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 120_000),
      },
      {
        ...event.ticketTypes[0],
        id: "ticket-type-2",
        name: "Lote 2",
        quantity: 100,
        sold: 0,
        priceCents: 15000,
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
      },
    ];
    const { service, tx } = createService(() => event);

    await service.execute("eventflow-conf", {
      ...createDto(),
      items: [{ ticketTypeId: "ticket-type-2", quantity: 1 }],
    } as any);

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: { create: [expect.objectContaining({ ticketTypeId: "ticket-type-2", quantity: 1 })] },
        }),
      }),
    );
  });

  it("opens the next lot with the unsold capacity from an expired previous lot", async () => {
    const event = createEvent(50);
    event.ticketTypes = [
      {
        ...event.ticketTypes[0],
        id: "ticket-type-1",
        name: "Lote 1",
        quantity: 100,
        sold: 50,
        startsAt: new Date(Date.now() - 120_000),
        endsAt: new Date(Date.now() - 60_000),
      },
      {
        ...event.ticketTypes[0],
        id: "ticket-type-2",
        name: "Lote 2",
        quantity: 100,
        sold: 0,
        priceCents: 15000,
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
      },
    ];
    const { service, tx } = createService(() => event);

    await service.execute("eventflow-conf", {
      ...createDto(),
      items: [{ ticketTypeId: "ticket-type-2", quantity: 5 }],
    } as any);

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotalCents: 75000,
          items: { create: [expect.objectContaining({ ticketTypeId: "ticket-type-2", quantity: 5 })] },
        }),
      }),
    );
  });

  describe("ticket returned to a sold-out lot after the next lot opened", () => {
    const lots = (firstSold: number, secondSold: number, secondOpenedAt: Date | null = null) => {
      const event = createEvent(0);
      event.ticketTypes = [
        {
          ...event.ticketTypes[0],
          id: "ticket-type-1",
          name: "Lote no escuro",
          quantity: 50,
          sold: firstSold,
          startsAt: new Date(Date.now() - 60_000),
          endsAt: new Date(Date.now() + 120_000),
        },
        {
          ...event.ticketTypes[0],
          id: "ticket-type-2",
          name: "1º Lote",
          quantity: 130,
          sold: secondSold,
          priceCents: 15000,
          startsAt: new Date(Date.now() + 60_000),
          endsAt: new Date(Date.now() + 120_000),
          openedAt: secondOpenedAt,
        } as any,
      ];
      return event;
    };
    const buy = (service: CreateCheckoutUseCase, ticketTypeId: string, quantity = 1) =>
      service.execute("eventflow-conf", { ...createDto(), items: [{ ticketTypeId, quantity }] } as any);

    it("keeps selling the next lot", async () => {
      const { service, tx } = createService(() => lots(49, 5));

      await buy(service, "ticket-type-2");

      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ items: { create: [expect.objectContaining({ ticketTypeId: "ticket-type-2", quantity: 1 })] } }),
        }),
      );
    });

    it("keeps selling the next lot even when it opened but has no sale yet", async () => {
      const { service, tx } = createService(() => lots(49, 0, new Date(Date.now() - 30_000)));

      await buy(service, "ticket-type-2");

      expect(tx.order.create).toHaveBeenCalledTimes(1);
    });

    it("sells the returned ticket in the earlier lot at that lot's price", async () => {
      const { service, tx } = createService(() => lots(49, 5));

      await buy(service, "ticket-type-1");

      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ subtotalCents: 10000 }) }),
      );
    });

    it("does not sell more than what came back to the earlier lot", async () => {
      const { service, tx } = createService(() => lots(49, 5));

      await expect(buy(service, "ticket-type-1", 2)).rejects.toThrow("Não há ingressos suficientes para Lote no escuro.");
      expect(tx.order.create).not.toHaveBeenCalled();
    });

    it("keeps a lot that never opened closed while the earlier lot still has tickets", async () => {
      const { service } = createService(() => lots(49, 0));

      await expect(buy(service, "ticket-type-2")).rejects.toThrow("Lote de ingresso indisponível.");
    });

    it("marks the next lot as opened when the checkout sells out the current lot", async () => {
      const { service, prisma } = createService(() => lots(49, 0));
      // Estado já confirmado no banco depois desta compra: o lote no escuro esgotou.
      prisma.ticketType.findMany.mockResolvedValueOnce(lots(50, 0).ticketTypes as any[]);

      await buy(service, "ticket-type-1");

      expect(prisma.ticketType.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["ticket-type-2"] }, openedAt: null },
        data: { openedAt: expect.any(Date) },
      });
    });

    it("does not fail the order when marking the opened lots fails", async () => {
      const { service, prisma, tx } = createService(() => lots(49, 0));
      prisma.ticketType.findMany.mockRejectedValueOnce(new Error("db down"));

      await expect(buy(service, "ticket-type-1")).resolves.toBeDefined();
      expect(tx.order.create).toHaveBeenCalledTimes(1);
    });
  });

  it("defers the coupon reservation until after the order is created and still enforces the limit", async () => {
    const { service, tx } = createService();
    tx.coupon.findUnique.mockResolvedValue({
      id: "coupon-1", tenantId: "tenant-1", ownerId: "owner-1", isActive: true, maxUses: 1, usedCount: 0,
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

describe("CreateCheckoutUseCase default CPF limit for zero-total orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function freeEvent(limitPerCpf: number | null = null) {
    const event = createEvent(0);
    event.limitPerCpf = limitPerCpf as any;
    event.ticketTypes[0].priceCents = 0;
    event.ticketTypes[0].quantity = 100;
    event.ticketTypes[0].limitPerBuy = 2;
    return event;
  }

  it("creates a free order when the CPF is within one purchase worth of tickets", async () => {
    const { service, orders } = createService(() => freeEvent());

    const order = await service.execute("eventflow-conf", { ...createDto(), items: [{ ticketTypeId: "ticket-type-1", quantity: 2 }] } as any);

    expect(order.totalCents).toBe(0);
    expect(orders).toHaveLength(1);
  });

  it("blocks a CPF from accumulating free tickets beyond one purchase when the event has no CPF limit", async () => {
    const { service, tx, getSold } = createService(() => freeEvent());
    tx.order.findMany.mockResolvedValue([{ items: [{ quantity: 2 }] }]);

    await expect(service.execute("eventflow-conf", createDto() as any)).rejects.toThrow(
      "Limite excedido. O limite e de 2 ingressos por CPF/Documento.",
    );
    expect(getSold()).toBe(0);
  });

  it("keeps the organizer's own CPF limit when one is set", async () => {
    const { service, tx, orders } = createService(() => freeEvent(10));
    tx.order.findMany.mockResolvedValue([{ items: [{ quantity: 2 }] }]);

    await service.execute("eventflow-conf", createDto() as any);

    expect(orders).toHaveLength(1);
  });

  it("does not apply the default CPF limit to paid orders", async () => {
    const paidEvent = () => {
      const event = freeEvent();
      event.ticketTypes[0].priceCents = 10000;
      return event;
    };
    const { service, tx, orders } = createService(paidEvent);
    tx.order.findMany.mockResolvedValue([{ items: [{ quantity: 50 }] }]);

    await service.execute("eventflow-conf", createDto() as any);

    expect(orders).toHaveLength(1);
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });
});
