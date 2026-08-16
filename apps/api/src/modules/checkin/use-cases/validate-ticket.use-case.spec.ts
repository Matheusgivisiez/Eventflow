import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CheckInStatus, TicketStatus } from "@prisma/client";
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
    orderId: "order-1",
    eventId: "event-1",
    status: TicketStatus.AVAILABLE,
    usedAt: null,
    event: { id: "event-1", tenantId: "tenant-1", title: "EventHub Conf" },
    ticketType: { id: "ticket-type-1", name: "Inteira" },
    ...overrides
  };
}

function createService() {
  const prisma = {
    ticket: {
      findFirst: jest.fn(),
      update: jest.fn()
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
    prisma.ticket.update.mockResolvedValue(createTicket({ status: TicketStatus.USED, usedAt: new Date() }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.ENTERED);
    expect(result.message).toBe("Entrada liberada.");
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: "event-1",
        event: { tenantId: "tenant-1" },
        uuid: "ticket-uuid"
      },
      include: { event: true, ticketType: true }
    });
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: {
        status: TicketStatus.USED,
        usedAt: expect.any(Date),
        checkIns: { create: { userId: "checkin-user-1", status: CheckInStatus.ENTERED } }
      },
      include: { event: true, ticketType: true }
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
    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(prisma.checkInLog.create).not.toHaveBeenCalled();
  });

  it("returns DUPLICATED and logs the attempt when ticket was already used", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({ status: TicketStatus.USED, usedAt: new Date() }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.DUPLICATED);
    expect(result.message).toBe("Entrada duplicada.");
    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(prisma.checkInLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: "ticket-1",
        userId: "checkin-user-1",
        status: CheckInStatus.DUPLICATED,
        reason: "Ingresso ja utilizado."
      }
    });
  });

  it("returns REFUSED and logs the attempt when ticket is canceled", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(createTicket({ status: TicketStatus.CANCELED }));

    const result = await service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload());

    expect(result.status).toBe(CheckInStatus.REFUSED);
    expect(result.message).toBe("Entrada recusada.");
    expect(prisma.ticket.update).not.toHaveBeenCalled();
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

    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(prisma.checkInLog.create).not.toHaveBeenCalled();
  });

  it("fails closed when QR_CODE_SECRET is missing", async () => {
    const { service, prisma, config } = createService();
    config.get.mockReturnValue(undefined);

    await expect(service.execute("event-1", "tenant-1", "checkin-user-1", qrPayload())).rejects.toThrow("QR_CODE_SECRET is required.");

    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});
