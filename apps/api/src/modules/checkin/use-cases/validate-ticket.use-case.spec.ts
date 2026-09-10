import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CheckInStatus, EventStatus, PaymentStatus, TicketStatus } from "@prisma/client";
import { createHmac } from "crypto";
import { ValidateTicketUseCase } from "./validate-ticket.use-case";

const qrSecret = "test-qrcode-secret-with-32-characters";

function sign(uuid: string, orderId: string) {
  return createHmac("sha256", qrSecret).update(`${uuid}:${orderId}`).digest("hex");
}

function qrPayload(uuid = "ticket-uuid", orderId = "order-1") {
  return JSON.stringify({
    uuid,
    orderId,
    signature: sign(uuid, orderId)
  });
}

function createTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    uuid: "ticket-uuid",
    hash: "ticket-hash",
    orderId: "order-1",
    eventId: "event-1",
    status: TicketStatus.AVAILABLE,
    usedAt: null,
    event: {
      id: "event-1",
      tenantId: "tenant-1",
      title: "Event Flow Conf",
      status: EventStatus.PUBLISHED,
      startsAt: new Date(Date.now() - 60_000),
      checkInOpensAt: new Date(Date.now() - 60_000),
      checkInClosesAt: null
    },
    ticketType: { id: "ticket-type-1", name: "Inteira" },
    order: { id: "order-1", status: PaymentStatus.PAID },
    ...overrides
  };
}

function createService() {
  const prisma = {
    ticket: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn()
    },
    checkInLog: {
      create: jest.fn()
    }
  };
  const config = {
    get: jest.fn((key: string) => key === "QR_CODE_SECRET" ? qrSecret : undefined)
  };
  const service = new ValidateTicketUseCase(prisma as any, config as any);
  return { service, prisma, config };
}

describe("ValidateTicketUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid signed QR code and marks the ticket as used", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket());
    prisma.ticket.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.ENTERED);
    expect(result.message).toBe("Entrada liberada.");
    expect(result.ticket.status).toBe(TicketStatus.USED);
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
      where: {
        event: { tenantId: "tenant-1" },
        eventId: "event-1",
        OR: [
          { uuid: "ticket-uuid" },
          { hash: "ticket-uuid" },
          { id: "ticket-uuid" },
          { uuid: { startsWith: "ticket-uuid", mode: "insensitive" } }
        ]
      },
      include: { event: true, ticketType: true, order: true }
    });
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: "ticket-1", status: TicketStatus.AVAILABLE },
      data: {
        status: TicketStatus.USED,
        usedAt: expect.any(Date)
      }
    });
    expect(prisma.checkInLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: "ticket-1",
        userId: "checkin-user-1",
        status: CheckInStatus.ENTERED,
        reason: undefined
      }
    });
  });

  it("accepts a short code prefix (8 uppercase chars) and marks the ticket as used", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket());
    prisma.ticket.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", "TICKET-U");

    expect(result.status).toBe(CheckInStatus.ENTERED);
    expect(result.message).toBe("Entrada liberada.");
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
      where: {
        event: { tenantId: "tenant-1" },
        eventId: "event-1",
        OR: [
          { uuid: "TICKET-U" },
          { hash: "TICKET-U" },
          { id: "TICKET-U" },
          { uuid: { startsWith: "TICKET-U", mode: "insensitive" } }
        ]
      },
      include: { event: true, ticketType: true, order: true }
    });
  });

  it("rejects an adulterated signed QR code before querying tickets", async () => {
    const { service, prisma } = createService();
    const forgedQr = JSON.stringify({
      uuid: "ticket-uuid",
      orderId: "order-1",
      signature: "forged-signature"
    });

    await expect(service.execute("event-1", "tenant-1", "checkin-user-1", forgedQr)).rejects.toThrow(BadRequestException);

    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    expect(prisma.checkInLog.create).not.toHaveBeenCalled();
  });

  it("returns DUPLICATED and logs the attempt when ticket was already used", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({ status: TicketStatus.USED, usedAt: new Date() }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.DUPLICATED);
    expect(result.message).toBe("Entrada duplicada.");
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    expect(prisma.checkInLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: "ticket-1",
        userId: "checkin-user-1",
        status: CheckInStatus.DUPLICATED,
        reason: "Ingresso ja utilizado."
      }
    });
  });

  it("returns REFUSED when ticket belongs to another event", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({ eventId: "other-event-2" }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.REFUSED);
    expect(result.message).toBe("Ingresso pertence a outro evento.");
    expect(prisma.checkInLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: "ticket-1",
        userId: "checkin-user-1",
        status: CheckInStatus.REFUSED,
        reason: "Ingresso pertence a outro evento."
      }
    });
  });

  it("refuses a valid signed QR before the portaria opens without consuming the ticket", async () => {
    const { service, prisma } = createService();
    const opensAt = new Date(Date.now() + 60_000);
    prisma.ticket.findFirst.mockResolvedValue(createTicket({
      event: { ...createTicket().event, checkInOpensAt: opensAt }
    }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.REFUSED);
    expect(result.message).toBe(`A portaria abre em ${opensAt.toISOString()}.`);
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    expect(prisma.checkInLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: CheckInStatus.REFUSED, reason: result.message })
    });
  });

  it("refuses a valid signed QR after the portaria closes without consuming the ticket", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({
      event: { ...createTicket().event, checkInClosesAt: new Date(Date.now() - 60_000) }
    }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.REFUSED);
    expect(result.message).toBe("A portaria deste evento já foi encerrada.");
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("refuses check-in for a closed event without consuming the ticket", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({
      event: { ...createTicket().event, status: EventStatus.CLOSED }
    }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.REFUSED);
    expect(result.message).toBe("Check-in indisponível para evento não publicado ou encerrado.");
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("returns REFUSED when ticket order is unpaid or canceled", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({ order: { id: "order-1", status: PaymentStatus.PENDING } }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.REFUSED);
    expect(result.message).toBe("Ingresso com pagamento pendente ou cancelado.");
  });

  it("returns REFUSED and logs the attempt when ticket is canceled", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({ status: TicketStatus.CANCELED }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.REFUSED);
    expect(result.message).toBe("Entrada recusada.");
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    expect(prisma.checkInLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: "ticket-1",
        userId: "checkin-user-1",
        status: CheckInStatus.REFUSED,
        reason: "Ingresso cancelado ou indisponivel."
      }
    });
  });

  it("throws NotFoundException when ticket does not belong to the event tenant", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(null);

    await expect(service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload())).rejects.toThrow(NotFoundException);

    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    expect(prisma.checkInLog.create).not.toHaveBeenCalled();
  });

  it("fails closed when QR_CODE_SECRET is missing", async () => {
    const { service, prisma, config } = createService();
    config.get.mockReturnValue(undefined);

    await expect(service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload())).rejects.toThrow("QR_CODE_SECRET is required.");

    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("allows only one concurrent validation to enter", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst
      .mockResolvedValueOnce(createTicket())
      .mockResolvedValueOnce(createTicket());
    prisma.ticket.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.ticket.findUnique.mockResolvedValue(createTicket({ status: TicketStatus.USED, usedAt: new Date() }));

    const [first, second] = await Promise.all([
      service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload()),
      service.execute("event-1", "tenant-1", "checkin-user-2", qrPayload())
    ]);

    expect(first.status).toBe(CheckInStatus.ENTERED);
    expect(second.status).toBe(CheckInStatus.DUPLICATED);
    expect(prisma.ticket.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.ticket.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "ticket-1", status: TicketStatus.AVAILABLE },
      data: { status: TicketStatus.USED, usedAt: expect.any(Date) }
    });
    expect(prisma.ticket.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "ticket-1", status: TicketStatus.AVAILABLE },
      data: { status: TicketStatus.USED, usedAt: expect.any(Date) }
    });
    expect(prisma.checkInLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: "ticket-1",
        userId: "checkin-user-1",
        status: CheckInStatus.ENTERED,
        reason: undefined
      }
    });
    expect(prisma.checkInLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: "ticket-1",
        userId: "checkin-user-2",
        status: CheckInStatus.DUPLICATED,
        reason: "Ingresso ja utilizado."
      }
    });
  });
});
