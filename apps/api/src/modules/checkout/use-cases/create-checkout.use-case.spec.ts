import { BadRequestException } from "@nestjs/common";
import { EventFormat, EventStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { CreateCheckoutUseCase } from "./create-checkout.use-case";

function createEvent(sold = 0) {
  return {
    id: "event-1",
    tenantId: "tenant-1",
    ownerId: "owner-1",
    title: "EventHub Conf",
    slug: "eventhub-conf",
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
        isActive: true
      }
    ]
  };
}

function createDto() {
  return {
    buyerName: "Buyer",
    buyerEmail: "buyer@example.com",
    buyerDocument: "12345678900",
    buyerPhone: "11999999999",
    paymentMethod: PaymentMethod.PIX,
    items: [{ ticketTypeId: "ticket-type-1", quantity: 1 }]
  };
}

function createService() {
  let sold = 0;
  const orders: any[] = [];
  const tx = {
    event: {
      findFirst: jest.fn(async () => createEvent(0))
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async ({ data }) => {
        const order = {
          id: `order-${orders.length + 1}`,
          ...data,
          items: data.items.create,
          payment: data.payment.create
        };
        orders.push(order);
        return order;
      })
    },
    coupon: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    affiliateLink: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    promoterLink: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    affiliateCommission: {
      create: jest.fn()
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
      })
    }
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx))
  };
  const coupons = {
    calculateDiscount: jest.fn().mockReturnValue(0)
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

    const firstOrder = await service.execute("eventhub-conf", createDto() as any);
    await expect(service.execute("eventhub-conf", createDto() as any)).rejects.toThrow(BadRequestException);

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

    await service.execute("eventhub-conf", createDto() as any);
    await expect(service.execute("eventhub-conf", createDto() as any)).rejects.toThrow("Nao ha ingressos suficientes");

    expect(tx.order.create).toHaveBeenCalledTimes(1);
    expect(orders).toHaveLength(1);
  });
});
