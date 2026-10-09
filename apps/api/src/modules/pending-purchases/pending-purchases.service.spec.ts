import { ConflictException, NotFoundException } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { PendingPurchasesService } from "./pending-purchases.service";

const now = new Date("2026-10-07T16:00:00.000Z");
const user = { id: "user-1", email: "buyer@example.com", emailVerified: true } as any;

function createService(enabled = true) {
  const prisma = { order: { findMany: jest.fn(), findUnique: jest.fn() } };
  const config = { get: jest.fn((key: string) => key === "PENDING_PURCHASES_ENABLED" ? enabled : key === "ORDER_RESERVATION_TTL_MINUTES" ? 60 : undefined) };
  const payments = { reconcileProviderStatus: jest.fn() };
  const service = new PendingPurchasesService(prisma as any, config as any, payments as any);
  return { service, prisma, payments };
}

function pendingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1", userId: "user-1", buyerEmail: "buyer@example.com", orderAccessToken: "guest-token",
    status: PaymentStatus.PENDING, stockReservedAt: new Date("2026-10-07T15:30:00.000Z"),
    event: { tenantId: "tenant-1" },
    payment: { id: "payment-1", provider: "infinite_pay", checkoutUrl: "https://pay.infinitepay.io/abc", checkoutId: "abc", transactionId: null },
    ...overrides
  };
}

describe("PendingPurchasesService", () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
  afterEach(() => jest.useRealTimers());

  it("stays inactive with the flag off", async () => {
    const { service, prisma } = createService(false);
    await expect(service.list(user)).resolves.toEqual([]);
    await expect(service.resume("order-1", user)).rejects.toThrow(NotFoundException);
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  it("lists only the account and verified guest orders, without leaking checkout URLs", async () => {
    const { service, prisma } = createService();
    prisma.order.findMany.mockResolvedValue([{
      id: "order-1", stockReservedAt: new Date("2026-10-07T15:30:00.000Z"), totalCents: 1000,
      event: { title: "Show", slug: "show", startsAt: now, bannerUrl: null },
      items: [{ quantity: 1, ticketType: { name: "Primeiro lote" } }],
      payment: { checkoutUrl: "https://pay.infinitepay.io/abc" }
    }]);
    const result = await service.list(user);
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ userId: "user-1" }, { userId: null, buyerEmail: "buyer@example.com" }] })
    }));
    expect(result).toEqual([expect.objectContaining({ reservedUntil: "2026-10-07T16:30:00.000Z" })]);
    expect(JSON.stringify(result)).not.toContain("checkoutUrl");
  });

  it("does not claim guest orders through an unverified e-mail", async () => {
    const { service, prisma } = createService();
    prisma.order.findMany.mockResolvedValue([]);
    await service.list({ ...user, emailVerified: false });
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ userId: "user-1" }] })
    }));
  });

  it("returns the same hosted link to its owner or token holder", async () => {
    const { service, prisma } = createService();
    prisma.order.findUnique.mockResolvedValue(pendingOrder());
    await expect(service.resume("order-1", user)).resolves.toEqual({ checkoutUrl: "https://pay.infinitepay.io/abc", reservedUntil: "2026-10-07T16:30:00.000Z" });
    await expect(service.resume("order-1", undefined, "guest-token")).resolves.toEqual(expect.objectContaining({ checkoutUrl: "https://pay.infinitepay.io/abc" }));
  });

  it("does not reveal another buyer's link", async () => {
    const { service, prisma } = createService();
    prisma.order.findUnique.mockResolvedValue(pendingOrder());
    await expect(service.resume("order-1", { ...user, id: "other", email: "other@example.com" }, "wrong-token")).rejects.toThrow(NotFoundException);
  });

  it("refuses expired reservations and untrusted URLs", async () => {
    const { service, prisma } = createService();
    prisma.order.findUnique.mockResolvedValueOnce(pendingOrder({ stockReservedAt: new Date("2026-10-07T14:00:00.000Z") }))
      .mockResolvedValueOnce(pendingOrder({ payment: { provider: "infinite_pay", checkoutUrl: "https://evil.example/pay" } }));
    await expect(service.resume("order-1", user)).rejects.toThrow(ConflictException);
    await expect(service.resume("order-1", user)).rejects.toThrow(ConflictException);
  });

  it("rechecks a known provider transaction before resuming", async () => {
    const { service, prisma, payments } = createService();
    prisma.order.findUnique.mockResolvedValueOnce(pendingOrder({ payment: { ...pendingOrder().payment, transactionId: "nsu" } }))
      .mockResolvedValueOnce(pendingOrder({ status: PaymentStatus.PAID }));
    await expect(service.resume("order-1", user)).rejects.toThrow(ConflictException);
    expect(payments.reconcileProviderStatus).toHaveBeenCalledWith("payment-1", "tenant-1");
  });
});
