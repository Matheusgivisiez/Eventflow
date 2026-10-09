jest.mock("sharp", () =>
  jest.fn(() => ({
    rotate: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.alloc(12000, 0xff))
  }))
);

import { PaymentStatus, TicketOrigin, TicketStatus } from "@prisma/client";
import { BuyerService } from "./buyer.service";
import { transferTicketDownloadToken } from "../../common/utils/transfer-ticket-download";
import { vipTicketDownloadToken } from "../../common/utils/vip-ticket-download";

const now = new Date("2026-09-04T15:00:00.000Z");

function createTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    uuid: "ticket-uuid",
    signature: "ticket-signature",
    qrCodeDataUrl: "data:image/png;base64,qrcode",
    orderId: "order-1",
    eventId: "event-1",
    ticketTypeId: "ticket-type-1",
    ownerId: "user-1",
    attendeeName: "Comprador",
    attendeeEmail: "buyer@example.com",
    status: TicketStatus.AVAILABLE,
    event: {
      id: "event-1",
      title: "Event Flow Conf",
      startsAt: new Date("2026-09-04T14:00:00.000Z"),
      endsAt: new Date("2026-09-04T18:00:00.000Z"),
      qrCodeReleaseAt: null,
      qrCodeReleaseMinutesBeforeStart: null,
      allowTicketTransfer: true,
      ticketTransferLockTime: null,
    },
    ticketType: { id: "ticket-type-1", name: "Inteira" },
    order: { id: "order-1", userId: "user-1", payment: null },
    transfers: [],
    ...overrides,
  };
}

function createService() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ticket: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    ticketType: { updateMany: jest.fn() },
    transfer: { findFirst: jest.fn() },
    seat: { updateMany: jest.fn() },
    seatReservation: { updateMany: jest.fn() },
    $transaction: jest.fn((callback) => callback(prisma)),
  };
  const audit = { log: jest.fn() };
  const payments = { updateStatus: jest.fn(), reconcileProviderStatus: jest.fn() };
  const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
  const service = new BuyerService(
    prisma as any,
    audit as any,
    payments as any,
    cache as any,
  );

  return { service, prisma, cache };
}

describe("transfer email PDF download", () => {
  it("serves the ticket only while the email recipient still owns it", async () => {
    const { service, prisma } = createService();
    const ticket = createTicket({ ownerId: "receiver-1" });
    prisma.transfer.findFirst.mockResolvedValue({
      id: "transfer-1", ticketId: "ticket-1", receiverId: "receiver-1", ticket,
    });
    (service as any).config = { get: () => "secret" };
    const token = transferTicketDownloadToken("secret", "transfer-1", "ticket-1", "receiver-1");
    const render = jest.spyOn(service, "renderTicketPdfFor").mockResolvedValue(Buffer.from("%PDF-test"));

    await expect(service.transferredTicketPdf("transfer-1", token)).resolves.toEqual(Buffer.from("%PDF-test"));
    expect(render).toHaveBeenCalledWith(ticket);

    ticket.ownerId = "receiver-2";
    await expect(service.transferredTicketPdf("transfer-1", token)).rejects.toThrow("Ingresso não encontrado");
    await expect(service.transferredTicketPdf("transfer-1", "invalid")).rejects.toThrow("Ingresso não encontrado");
  });
});

describe("VIP PDF visual routing", () => {
  it("uses gold only for a platform courtesy on the authenticated download", async () => {
    const { service, prisma } = createService();
    const render = jest.spyOn(service as any, "renderTicketPdf").mockResolvedValue(Buffer.from("%PDF"));
    prisma.ticket.findFirst.mockResolvedValueOnce(createTicket({ origin: TicketOrigin.PLATFORM_COURTESY }));
    await service.ticketPdf("user-1", "buyer@example.com", "ticket-1");
    expect(render).toHaveBeenLastCalledWith(expect.objectContaining({ vip: true }));

    prisma.ticket.findFirst.mockResolvedValueOnce(createTicket({ origin: TicketOrigin.ORGANIZER_COURTESY }));
    await service.ticketPdf("user-1", "buyer@example.com", "ticket-1");
    expect(render).toHaveBeenLastCalledWith(expect.objectContaining({ vip: false }));
  });
});

describe("VIP email PDF download", () => {
  it("accepts the invitation token only for the current named owner", async () => {
    const { service, prisma } = createService();
    const ticket = createTicket({ ownerId: "owner-1" });
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    (service as any).config = { get: () => "secret" };
    const render = jest.spyOn(service, "renderTicketPdfFor").mockResolvedValue(Buffer.from("%PDF-vip"));
    const token = vipTicketDownloadToken("secret", "ticket-1", "owner-1");

    await expect(service.vipTicketPdf("ticket-1", token)).resolves.toEqual(Buffer.from("%PDF-vip"));
    expect(render).toHaveBeenCalledWith(ticket, { vip: true });
    ticket.ownerId = "owner-2";
    await expect(service.vipTicketPdf("ticket-1", token)).rejects.toThrow("Ingresso não encontrado");
  });
});

describe("BuyerService.listTickets", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("finds tickets by ownerId, order userId, or the normalized attendee and buyer e-mail", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.listTickets("user-1", "Buyer@Example.COM");

    expect(prisma.ticket.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { ownerId: "user-1" },
          {
            ownerId: null,
            OR: [
              { order: { userId: "user-1" } },
              { attendeeEmail: "buyer@example.com" },
              { order: { buyerEmail: "buyer@example.com" } },
            ],
          },
        ],
        event: undefined,
      },
      include: {
        event: true,
        ticketType: true,
        order: { include: { payment: true } },
        transfers: {
          where: {
            senderId: "user-1",
            status: "PENDING",
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: {
            id: true,
            receiverEmail: true,
            createdAt: true,
            expiresAt: true,
            receiver: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { event: { startsAt: "asc" } },
    });
  });

  it("returns the active pending transfer with safe recipient details", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findMany.mockResolvedValue([
      createTicket({
        transfers: [{
          id: "transfer-1",
          receiverEmail: "receiver@example.com",
          createdAt: now,
          expiresAt: new Date("2026-09-05T15:00:00.000Z"),
          receiver: { name: "Matheus", email: "receiver@example.com" },
        }],
      }),
    ]);

    const [ticket] = await service.listTickets("user-1", "buyer@example.com");

    expect(ticket.pendingTransfer).toEqual({
      id: "transfer-1",
      receiverName: "Matheus",
      receiverEmail: "receiver@example.com",
      createdAt: now.toISOString(),
      expiresAt: "2026-09-05T15:00:00.000Z",
    });
    expect(ticket).not.toHaveProperty("transfers");
  });

  it("never matches guest orders by e-mail when the account e-mail is unverified", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.listTickets("user-1", null);

    const where = prisma.ticket.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain("buyerEmail");
    expect(JSON.stringify(where)).not.toContain("attendeeEmail");
    expect(where.OR).toEqual([
      { ownerId: "user-1" },
      { ownerId: null, OR: [{ order: { userId: "user-1" } }] },
    ]);
  });

  it("never reconciles orphan guest orders by e-mail when the account e-mail is unverified", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.listTickets("user-1", null);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: [{ userId: "user-1" }] }),
      }),
    );
  });

  it("repairs paid orders that never emitted tickets before listing the wallet", async () => {
    const { service, prisma } = createService();
    prisma.order.findMany.mockResolvedValue([
      {
        id: "order-1",
        status: PaymentStatus.PAID,
        event: { tenantId: "tenant-1" },
        payment: { id: "payment-1" },
        _count: { tickets: 0 },
      },
    ]);
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.listTickets("user-1", "buyer@example.com");

    expect(service["payments"].updateStatus).toHaveBeenCalledWith("payment-1", "tenant-1", {
      status: PaymentStatus.PAID,
    });
  });

  it("reconciles pending orders with the provider before listing the wallet", async () => {
    const { service, prisma } = createService();
    prisma.order.findMany.mockResolvedValue([
      {
        id: "order-1",
        status: PaymentStatus.PENDING,
        event: { tenantId: "tenant-1" },
        payment: { id: "payment-1" },
        _count: { tickets: 0 },
      },
    ]);
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.listTickets("user-1", "buyer@example.com");

    expect(service["payments"].reconcileProviderStatus).toHaveBeenCalledWith("payment-1", "tenant-1");
  });

  it("skips order reconciliation when the recent wallet check is cached", async () => {
    const { service, prisma, cache } = createService();
    cache.get.mockResolvedValue({ checkedAt: Date.now() });
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.listTickets("user-1", "buyer@example.com");

    expect(prisma.order.findMany).not.toHaveBeenCalled();
    expect(service["payments"].reconcileProviderStatus).not.toHaveBeenCalled();
    expect(service["payments"].updateStatus).not.toHaveBeenCalled();
  });

  it("keeps an event that already started in the future scope until its endsAt", async () => {
    const { service, prisma } = createService();
    const ongoingTicket = createTicket();
    prisma.ticket.findMany.mockResolvedValue([ongoingTicket]);

    const result = await service.listTickets(
      "user-1",
      "buyer@example.com",
      "future",
    );

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event: {
            OR: [
              { endsAt: { gte: now } },
              { endsAt: null, startsAt: { gte: now } },
            ],
          },
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(ongoingTicket.id);
  });

  it("masks all QR credentials while the QR code is locked", async () => {
    const { service, prisma } = createService();
    const releaseAt = new Date("2026-09-04T17:00:00.000Z");
    prisma.ticket.findMany.mockResolvedValue([
      createTicket({
        event: {
          ...createTicket().event,
          qrCodeReleaseAt: releaseAt,
        },
      }),
    ]);

    const [ticket] = await service.listTickets("user-1", "buyer@example.com");

    expect(ticket).toEqual(
      expect.objectContaining({
        id: "ticket-1",
        uuid: null,
        signature: null,
        qrCodeDataUrl: null,
        qrCodeLocked: true,
        qrCodeReleaseAt: releaseAt.toISOString(),
      }),
    );
  });

  it("cancels only the selected ticket and preserves the order payment", async () => {
    const { service, prisma } = createService();
    const base = createTicket();
    const ticket = createTicket({
      status: TicketStatus.AVAILABLE,
      seatId: null,
      event: {
        ...base.event,
        startsAt: new Date("2026-09-10T20:00:00.000Z"),
        endsAt: null,
        allowTicketRefund: true,
        ticketRefundLockHours: 24,
      },
    });
    prisma.ticket.findFirst.mockResolvedValue(ticket);
    prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
    prisma.ticketType.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.requestRefund("user-1", "buyer@example.com", "ticket-1", "CONFIRMAR");

    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: "ticket-1", status: TicketStatus.AVAILABLE },
      data: { status: TicketStatus.CANCELED },
    });
    expect(prisma.ticketType.updateMany).toHaveBeenCalledWith({
      where: { id: "ticket-type-1", sold: { gt: 0 } },
      data: { sold: { decrement: 1 } },
    });
    expect(service["payments"].updateStatus).not.toHaveBeenCalled();
    expect(result.status).toBe("REFUND_REQUESTED");
  });

  it("refuses refunds for courtesy tickets and never touches a lot's stock", async () => {
    const { service, prisma } = createService();
    const base = createTicket();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({
      origin: "PLATFORM_COURTESY",
      event: { ...base.event, startsAt: new Date("2026-09-10T20:00:00.000Z"), allowTicketRefund: true, ticketRefundLockHours: 24 },
    }));

    await expect(
      service.requestRefund("user-1", "buyer@example.com", "ticket-1", "CONFIRMAR"),
    ).rejects.toThrow("Ingressos de cortesia não têm reembolso.");
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    expect(prisma.ticketType.updateMany).not.toHaveBeenCalled();
  });

  it("shows a courtesy ticket in the guest wallet as non-refundable and non-transferable", async () => {
    const { service, prisma } = createService();
    const base = createTicket();
    prisma.ticket.findMany.mockResolvedValue([createTicket({
      origin: "ORGANIZER_COURTESY",
      event: { ...base.event, startsAt: new Date("2026-09-10T20:00:00.000Z"), allowTicketRefund: true, ticketRefundLockHours: 24 },
    })]);

    const [ticket] = await service.listTickets("user-1", "buyer@example.com");

    expect(ticket.refundAvailable).toBe(false);
    expect(ticket.refundBlockedReason).toBe("Ingressos de cortesia não têm reembolso.");
    expect(ticket.event.allowTicketTransfer).toBe(false);
  });

  it("refuses refunds when the organizer disabled them for the event", async () => {
    const { service, prisma } = createService();
    const base = createTicket();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({
      event: { ...base.event, startsAt: new Date("2026-09-10T20:00:00.000Z"), allowTicketRefund: false },
    }));

    await expect(
      service.requestRefund("user-1", "buyer@example.com", "ticket-1", "CONFIRMAR"),
    ).rejects.toThrow("não aceita reembolso");
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("refuses refunds after the organizer deadline", async () => {
    const { service, prisma } = createService();
    const base = createTicket();
    // Evento em 5h, prazo fecha 24h antes: já passou.
    prisma.ticket.findFirst.mockResolvedValue(createTicket({
      event: {
        ...base.event,
        startsAt: new Date("2026-09-04T20:00:00.000Z"),
        allowTicketRefund: true,
        ticketRefundLockHours: 24,
      },
    }));

    await expect(
      service.requestRefund("user-1", "buyer@example.com", "ticket-1", "CONFIRMAR"),
    ).rejects.toThrow("prazo");
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("exposes the refund policy on each ticket of the wallet", async () => {
    const { service, prisma } = createService();
    const base = createTicket();
    prisma.ticket.findMany.mockResolvedValue([
      createTicket({
        event: {
          ...base.event,
          startsAt: new Date("2026-09-10T20:00:00.000Z"),
          allowTicketRefund: true,
          ticketRefundLockHours: 48,
        },
      }),
      createTicket({ id: "ticket-2", event: { ...base.event, allowTicketRefund: false } }),
    ]);

    const [allowed, disabled] = await service.listTickets("user-1", "buyer@example.com");

    expect(allowed).toEqual(expect.objectContaining({
      refundAvailable: true,
      refundBlockedReason: null,
      refundDeadline: "2026-09-08T20:00:00.000Z",
    }));
    expect(disabled).toEqual(expect.objectContaining({
      refundAvailable: false,
      refundDeadline: null,
    }));
  });

  it("requires the CONFIRMAR phrase before cancelling a ticket", async () => {
    const { service, prisma } = createService();

    await expect(
      service.requestRefund("user-1", "buyer@example.com", "ticket-1", "cancelar"),
    ).rejects.toThrow("Digite CONFIRMAR");
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("renders a downloadable ticket PDF with the visual ticket and QR code", async () => {
    jest.useRealTimers();
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({ qrCodeDataUrl: null }));

    const pdf = await service.ticketPdf("user-1", "buyer@example.com", "ticket-1");

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(10_000);
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "ticket-1" }),
      include: { event: true, ticketType: true, order: true },
    }));
  });

  it("still downloads a PDF with a protected placeholder before QR release", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({
      qrCodeDataUrl: null,
      event: {
        title: "Evento futuro",
        startsAt: new Date("2030-10-22T23:00:00.000Z"),
        qrCodeReleaseAt: new Date("2030-10-22T22:00:00.000Z"),
        qrCodeReleaseMinutesBeforeStart: null,
      },
    }));

    const pdf = await service.ticketPdf("user-1", "buyer@example.com", "ticket-1");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
