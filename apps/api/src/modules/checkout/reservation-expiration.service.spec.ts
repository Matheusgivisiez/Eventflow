import { PaymentStatus } from "@prisma/client";
import { ReservationExpirationService } from "./reservation-expiration.service";

function createService() {
  const tx = {
    order: { updateMany: jest.fn() },
    payment: { updateMany: jest.fn() },
    ticketType: { update: jest.fn() },
    coupon: { updateMany: jest.fn() }
  };
  const prisma = {
    order: { findMany: jest.fn() },
    $transaction: jest.fn((callback) => callback(tx))
  };
  const config = { get: jest.fn((key: string) => key === "ORDER_RESERVATION_TTL_MINUTES" ? 30 : undefined) };
  const service = new ReservationExpirationService(prisma as any, config as any);
  return { service, prisma, tx };
}

const staleOrder = {
  id: "order-1",
  couponId: "coupon-1",
  stockReservedAt: new Date(Date.now() - 31 * 60_000),
  items: [{ ticketTypeId: "ticket-type-1", quantity: 2 }]
};

describe("ReservationExpirationService", () => {
  afterEach(() => jest.useRealTimers());

  it("cancels a stale pending order once and releases its stock and coupon allocation", async () => {
    const { service, prisma, tx } = createService();
    prisma.order.findMany.mockResolvedValue([staleOrder]);
    tx.order.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.expireStaleReservations()).resolves.toEqual({ expiredOrders: 1 });

    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "order-1", status: PaymentStatus.PENDING }),
      data: { status: PaymentStatus.CANCELED, stockReservedAt: null }
    }));
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.CANCELED, canceledAt: expect.any(Date) }
    });
    expect(tx.ticketType.update).toHaveBeenCalledWith({
      where: { id: "ticket-type-1" },
      data: { sold: { decrement: 2 } }
    });
    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "coupon-1", usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } }
    });
  });

  it("does not release anything when another worker or webhook already claimed the order", async () => {
    const { service, prisma, tx } = createService();
    prisma.order.findMany.mockResolvedValue([staleOrder]);
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.expireStaleReservations()).resolves.toEqual({ expiredOrders: 0 });

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.ticketType.update).not.toHaveBeenCalled();
    expect(tx.coupon.updateMany).not.toHaveBeenCalled();
  });
});
