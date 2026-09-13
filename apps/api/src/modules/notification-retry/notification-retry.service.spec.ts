import { NotificationEvent, NotificationStatus, NotificationType } from "@prisma/client";
import { NotificationRetryService } from "./notification-retry.service";

const now = new Date("2026-09-13T18:00:00.000Z");

function createService(flagEnabled: boolean | undefined = undefined) {
  const prisma = { notificationLog: { findMany: jest.fn().mockResolvedValue([]) } };
  const payments = { dispatchPurchaseConfirmed: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn((key: string): any =>
      key === "NOTIFICATION_RETRY_ENABLED" ? flagEnabled : undefined
    )
  };
  const service = new NotificationRetryService(prisma as any, payments as any, config as any);
  return { service, prisma, payments, config };
}

function stuckRow(overrides: Record<string, unknown> = {}) {
  return { id: "log-1", dedupeKey: "purchase-confirmed:order-1", attempts: 1, ...overrides };
}

describe("NotificationRetryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("re-drives a stuck confirmation through the payment funnel", async () => {
    // Going through dispatchPurchaseConfirmed is the point: every guard —
    // flag, order still PAID, dedupe key, lease, attempts ceiling — still runs.
    const { service, prisma, payments } = createService();
    prisma.notificationLog.findMany.mockResolvedValue([stuckRow()]);

    const result = await service.retryStuckNotifications(now);

    expect(payments.dispatchPurchaseConfirmed).toHaveBeenCalledWith("order-1");
    expect(result.retried).toBe(1);
  });

  it("looks only at failed rows and at PENDING rows whose lease expired", async () => {
    const { service, prisma } = createService();

    await service.retryStuckNotifications(now);

    const where = prisma.notificationLog.findMany.mock.calls[0][0].where;
    expect(where.type).toBe(NotificationType.EMAIL);
    expect(where.event).toBe(NotificationEvent.PURCHASE_CONFIRMED);
    expect(where.OR).toEqual([
      { status: NotificationStatus.FAILED },
      {
        status: NotificationStatus.PENDING,
        OR: [
          { claimedAt: { lt: new Date("2026-09-13T17:55:00.000Z") } },
          { claimedAt: null, sentAt: { lt: new Date("2026-09-13T17:55:00.000Z") } }
        ]
      }
    ]);
  });

  it("ignores rows that already exhausted their attempts", async () => {
    // Fifty exhausted rows would otherwise fill every batch forever and the
    // newer deliveries would never get a turn.
    const { service, prisma } = createService();

    await service.retryStuckNotifications(now);

    const where = prisma.notificationLog.findMany.mock.calls[0][0].where;
    expect(where.attempts).toEqual({ lt: 5 });
  });

  it("ignores rows older than a week", async () => {
    const { service, prisma } = createService();

    await service.retryStuckNotifications(now);

    const where = prisma.notificationLog.findMany.mock.calls[0][0].where;
    expect(where.sentAt).toEqual({ gte: new Date("2026-09-06T18:00:00.000Z") });
  });

  it("keeps going when one order fails to reprocess", async () => {
    const { service, prisma, payments } = createService();
    prisma.notificationLog.findMany.mockResolvedValue([
      stuckRow({ id: "log-1", dedupeKey: "purchase-confirmed:order-1" }),
      stuckRow({ id: "log-2", dedupeKey: "purchase-confirmed:order-2" })
    ]);
    payments.dispatchPurchaseConfirmed.mockRejectedValueOnce(new Error("banco fora"));

    const result = await service.retryStuckNotifications(now);

    expect(payments.dispatchPurchaseConfirmed).toHaveBeenCalledTimes(2);
    expect(result.retried).toBe(1);
  });

  it("skips rows without a usable dedupe key", async () => {
    const { service, prisma, payments } = createService();
    prisma.notificationLog.findMany.mockResolvedValue([stuckRow({ dedupeKey: null })]);

    const result = await service.retryStuckNotifications(now);

    expect(payments.dispatchPurchaseConfirmed).not.toHaveBeenCalled();
    expect(result.retried).toBe(0);
  });

  it("does not start a second pass while one is still running", async () => {
    const { service, prisma, payments } = createService();
    prisma.notificationLog.findMany.mockResolvedValue([stuckRow()]);
    let release: () => void = () => undefined;
    payments.dispatchPurchaseConfirmed.mockImplementation(
      () => new Promise<void>((resolve) => { release = resolve; })
    );

    const first = service.retryStuckNotifications(now);
    const second = await service.retryStuckNotifications(now);

    expect(second).toEqual({ retried: 0, skipped: true });

    release();
    await first;
  });

  it("does not schedule anything when the flag is off", () => {
    const { service, config } = createService(false);

    service.onModuleInit();
    service.onModuleDestroy();

    expect(config.get).toHaveBeenCalledWith("NOTIFICATION_RETRY_ENABLED");
    expect(service["timer"]).toBeUndefined();
  });

  it("schedules an unreferenced timer when enabled", () => {
    const { service } = createService(true);

    service.onModuleInit();

    expect(service["timer"]).toBeDefined();
    service.onModuleDestroy();
  });
});
