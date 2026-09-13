import { NotificationEvent, NotificationStatus, NotificationType } from "@prisma/client";
import { NotificationsService } from "./notifications.service";

function createService() {
  const prisma = {
    notificationLog: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      create: jest.fn(async ({ data }: any) => ({ id: "log-1", attempts: 0, ...data })),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    }
  };
  const mail = { send: jest.fn().mockResolvedValue({ status: "SENT", recipient: "buyer@example.com" }) };
  const config = {
    get: jest.fn((key: string): any => (key === "APP_URL" ? "https://app.example" : undefined))
  };
  const service = new NotificationsService(prisma as any, mail as any, config as any);
  return { service, prisma, mail };
}

const purchase = {
  email: "buyer@example.com",
  phone: "11999999999",
  orderId: "clorder000000000000000001",
  orderAccessToken: "order-access-token",
  buyerName: "Comprador Convidado",
  eventTitle: "Hallowparty",
  eventStartsAt: new Date("2026-10-22T23:00:00.000Z"),
  ticketCount: 2
};

describe("NotificationsService purchase confirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends the e-mail and records the delivery", async () => {
    const { service, prisma, mail } = createService();

    await service.sendPurchaseApproved(purchase);

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: `purchase-confirmed:${purchase.orderId}`,
          status: NotificationStatus.PENDING
        })
      })
    );
    expect(prisma.notificationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: NotificationStatus.SENT })
      })
    );
  });

  it("does not send a second e-mail for an order already notified", async () => {
    const { service, prisma, mail } = createService();
    prisma.notificationLog.findUnique.mockResolvedValue({
      id: "log-1",
      status: NotificationStatus.SENT,
      attempts: 1,
      sentAt: new Date()
    });

    const result = await service.sendPurchaseApproved(purchase);

    expect(result.email.duplicate).toBe(true);
    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
  });

  it("retries a previously failed delivery without creating a second row", async () => {
    const { service, prisma, mail } = createService();
    prisma.notificationLog.findUnique.mockResolvedValue({
      id: "log-1",
      status: NotificationStatus.FAILED,
      attempts: 1,
      sentAt: new Date()
    });

    const result = await service.sendPurchaseApproved(purchase);

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    expect(result.email.status).toBe(NotificationStatus.SENT);
  });

  it("stops retrying a delivery that keeps failing", async () => {
    const { service, prisma, mail } = createService();
    prisma.notificationLog.findUnique.mockResolvedValue({
      id: "log-1",
      status: NotificationStatus.FAILED,
      attempts: 5,
      sentAt: new Date()
    });

    const result = await service.sendPurchaseApproved(purchase);

    expect(mail.send).not.toHaveBeenCalled();
    expect(result.email.duplicate).toBe(true);
  });

  it("treats a concurrent insert on the same key as a duplicate", async () => {
    const { service, prisma, mail } = createService();
    prisma.notificationLog.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    const result = await service.sendPurchaseApproved(purchase);

    expect(result.email.duplicate).toBe(true);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("records a failure without throwing when SMTP is down", async () => {
    const { service, prisma, mail } = createService();
    mail.send.mockRejectedValue(new Error("SMTP down"));

    const result = await service.sendPurchaseApproved(purchase);

    expect(result.email.status).toBe(NotificationStatus.FAILED);
    expect(prisma.notificationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.FAILED,
          lastError: "SMTP down"
        })
      })
    );
  });

  it("records SKIPPED when SMTP is not configured", async () => {
    const { service, mail } = createService();
    mail.send.mockResolvedValue({ status: "SKIPPED", recipient: purchase.email });

    const result = await service.sendPurchaseApproved(purchase);

    expect(result.email.status).toBe(NotificationStatus.SKIPPED);
  });

  it("does not try to deliver the WhatsApp channel, which has no provider yet", async () => {
    const { service, mail } = createService();

    const result = await service.sendPurchaseApproved(purchase);

    expect(mail.send).toHaveBeenCalledTimes(1);
    // The row stays PENDING — which is exactly what the API has always
    // reported as QUEUED for a channel with no transport.
    expect(result.whatsapp?.status).toBe(NotificationStatus.PENDING);
  });

  it("points the buyer at the order page with its access token", async () => {
    const { service, mail } = createService();

    await service.sendPurchaseApproved(purchase);

    const body = mail.send.mock.calls[0][0];
    expect(body.text).toContain(
      `https://app.example/checkout/success?orderId=${purchase.orderId}&accessToken=order-access-token`
    );
    // In HTML the separator is entity-escaped, which is what a mail client expects.
    expect(body.html).toContain(
      `https://app.example/checkout/success?orderId=${purchase.orderId}&amp;accessToken=order-access-token`
    );
    expect(body.text).toContain("https://app.example/register");
  });

  it("never carries document, phone, ticket signature or QR payload", async () => {
    const { service, mail } = createService();

    await service.sendPurchaseApproved(purchase);

    const body = mail.send.mock.calls[0][0];
    const sent = `${body.subject}${body.text}${body.html}`;
    expect(sent).not.toContain(purchase.phone);
    expect(sent).not.toMatch(/cpf/i);
    expect(sent).not.toMatch(/signature/i);
    expect(sent).not.toMatch(/data:image/i);
  });

  it("keeps the log payload free of personal data beyond the order reference", async () => {
    const { service, prisma } = createService();

    await service.sendPurchaseApproved(purchase);

    const payload = prisma.notificationLog.create.mock.calls[0][0].data.payload;
    expect(payload).toEqual({
      orderId: purchase.orderId,
      eventTitle: purchase.eventTitle,
      ticketCount: purchase.ticketCount
    });
  });

  it("stores an EMAIL row of the PURCHASE_CONFIRMED event", async () => {
    const { service, prisma } = createService();

    await service.sendPurchaseApproved(purchase);

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.EMAIL,
          event: NotificationEvent.PURCHASE_CONFIRMED,
          recipient: purchase.email
        })
      })
    );
  });
});

describe("NotificationsService queue safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rescues a PENDING row abandoned before reaching SMTP", async () => {
    const { service, prisma, mail } = createService();
    prisma.notificationLog.findUnique.mockResolvedValue({
      id: "log-1",
      status: NotificationStatus.PENDING,
      attempts: 0,
      sentAt: new Date(Date.now() - 1000 * 60 * 30)
    });

    const result = await service.sendPurchaseApproved(purchase);

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(result.email.status).toBe(NotificationStatus.SENT);
  });

  it("leaves a freshly created PENDING row to its own caller", async () => {
    const { service, prisma, mail } = createService();
    prisma.notificationLog.findUnique.mockResolvedValue({
      id: "log-1",
      status: NotificationStatus.PENDING,
      attempts: 0,
      sentAt: new Date()
    });

    const result = await service.sendPurchaseApproved(purchase);

    expect(mail.send).not.toHaveBeenCalled();
    expect(result.email.duplicate).toBe(true);
  });

  it("claims the row before touching SMTP", async () => {
    const { service, prisma, mail } = createService();

    await service.sendPurchaseApproved(purchase);

    expect(prisma.notificationLog.updateMany).toHaveBeenCalledWith({
      where: { id: "log-1", attempts: 0 },
      data: { attempts: 1 }
    });
    expect(mail.send).toHaveBeenCalled();
  });

  it("does not send when another process claimed the same row first", async () => {
    const { service, prisma, mail } = createService();
    prisma.notificationLog.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.sendPurchaseApproved(purchase);

    expect(mail.send).not.toHaveBeenCalled();
    expect(result.email.duplicate).toBe(true);
  });
});

describe("NotificationsService public API contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps the response shape of POST /notifications", async () => {
    const { service } = createService();

    const result = await service.enqueue({
      type: NotificationType.EMAIL,
      event: NotificationEvent.EVENT_TOMORROW,
      recipient: "buyer@example.com",
      payload: { hello: "world" }
    });

    expect(result).toEqual({
      id: "log-1",
      status: "QUEUED",
      channel: NotificationType.EMAIL,
      event: NotificationEvent.EVENT_TOMORROW,
      recipient: "buyer@example.com"
    });
  });

  it("does not try to deliver a notification posted without a body", async () => {
    const { service, mail } = createService();

    await service.enqueue({
      type: NotificationType.EMAIL,
      event: NotificationEvent.EVENT_TOMORROW,
      recipient: "buyer@example.com",
      payload: {}
    });

    expect(mail.send).not.toHaveBeenCalled();
  });
});
