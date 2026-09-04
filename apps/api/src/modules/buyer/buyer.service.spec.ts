import { PaymentStatus } from "@prisma/client";
import { BuyerService } from "./buyer.service";

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
    ...overrides,
  };
}

function createService() {
  const prisma = {
    order: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ticket: {
      findMany: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  const payments = { updateStatus: jest.fn() };
  const service = new BuyerService(
    prisma as any,
    audit as any,
    payments as any,
  );

  return { service, prisma };
}

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
      },
      orderBy: { event: { startsAt: "asc" } },
    });
  });

  it("repairs paid orders that never emitted tickets before listing the wallet", async () => {
    const { service, prisma } = createService();
    prisma.order.findMany.mockResolvedValue([
      {
        id: "order-1",
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
});
