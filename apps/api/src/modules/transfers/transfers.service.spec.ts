import { BadRequestException } from "@nestjs/common";
import { NotificationEvent, TicketStatus, TransferStatus, UserRole } from "@prisma/client";
import QRCode from "qrcode";
import { TransfersService } from "./transfers.service";

jest.mock("qrcode", () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,new-qr") }
}));

const sender = {
  id: "sender-1",
  tenantId: null,
  email: "sender@example.com",
  role: UserRole.CUSTOMER
};

const receiver = {
  id: "receiver-1",
  tenantId: null,
  email: "receiver@example.com",
  role: UserRole.CUSTOMER
};

function createTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    uuid: "old-uuid",
    orderId: "order-1",
    eventId: "event-1",
    status: TicketStatus.AVAILABLE,
    usedAt: null,
    attendeeEmail: sender.email,
    ownerId: sender.id,
    event: {
      id: "event-1",
      title: "Event Flow Conf",
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      endsAt: null
    },
    ticketType: { name: "Inteira" },
    order: { id: "order-1", buyerEmail: sender.email, status: "PAID" },
    ...overrides
  };
}

function createTransfer(overrides: Record<string, unknown> = {}) {
  return {
    id: "transfer-1",
    ticketId: "ticket-1",
    senderId: sender.id,
    receiverId: receiver.id,
    receiverEmail: receiver.email,
    receiverCpf: null,
    status: TransferStatus.PENDING,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    ticket: createTicket(),
    sender: { id: sender.id, name: "Sender", email: sender.email },
    receiver: { id: receiver.id, name: "Receiver", email: receiver.email },
    history: [],
    ...overrides
  };
}

function createService() {
  const prisma = {
    user: {
      findUnique: jest.fn()
    },
    order: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    ticket: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    transfer: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn((callback) => callback(prisma))
  };
  const audit = { log: jest.fn().mockResolvedValue({}) };
  const notifications = { send: jest.fn().mockResolvedValue({}) };
  const config = { get: jest.fn().mockReturnValue("test-secret") };
  const service = new TransfersService(prisma as any, audit as any, notifications as any, config as any);
  return { service, prisma, audit, notifications };
}

describe("TransfersService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a pending transfer for a valid available ticket", async () => {
    const { service, prisma, notifications } = createService();
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email, avatarUrl: null });
    prisma.ticket.findFirst.mockResolvedValue(createTicket());
    prisma.transfer.findFirst.mockResolvedValue(null);
    prisma.transfer.create.mockResolvedValue(createTransfer());

    const result = await service.create(sender, { ticketId: "ticket-1", receiverEmail: receiver.email });

    expect(result.status).toBe(TransferStatus.PENDING);
    expect(prisma.transfer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ticketId: "ticket-1",
        senderId: sender.id,
        receiverId: receiver.id
      })
    }));
    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
      event: NotificationEvent.TICKET_TRANSFER_RECEIVED,
      recipient: receiver.email
    }));
  });

  it("blocks duplicate pending transfers for the same ticket", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email, avatarUrl: null });
    prisma.ticket.findFirst.mockResolvedValue(createTicket());
    prisma.transfer.findFirst.mockResolvedValue(createTransfer());

    await expect(service.create(sender, { ticketId: "ticket-1", receiverEmail: receiver.email })).rejects.toThrow(BadRequestException);
  });

  it("blocks transfers for used tickets", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email, avatarUrl: null });
    prisma.ticket.findFirst.mockResolvedValue(createTicket({ status: TicketStatus.USED, usedAt: new Date() }));

    await expect(service.create(sender, { ticketId: "ticket-1", receiverEmail: receiver.email })).rejects.toThrow(BadRequestException);
  });

  it("accepts a transfer, changes ticket owner, and regenerates QR data", async () => {
    const { service, prisma } = createService();
    prisma.transfer.findUnique
      .mockResolvedValueOnce(createTransfer())
      .mockResolvedValueOnce(createTransfer({ ticket: createTicket(), sender: { id: sender.id, email: sender.email } }));
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email });
    prisma.ticket.update.mockResolvedValue({});
    prisma.transfer.update.mockResolvedValue(createTransfer({ status: TransferStatus.ACCEPTED }));

    const result = await service.accept(receiver, "transfer-1");

    expect(result.status).toBe(TransferStatus.ACCEPTED);
    expect(QRCode.toDataURL).toHaveBeenCalled();
    expect(prisma.ticket.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ticket-1" },
      data: expect.objectContaining({
        ownerId: receiver.id,
        attendeeEmail: receiver.email,
        qrCodeDataUrl: "data:image/png;base64,new-qr"
      })
    }));
  });

  it("declines a pending transfer targeted to the authenticated user", async () => {
    const { service, prisma } = createService();
    prisma.transfer.findUnique.mockResolvedValue(createTransfer());
    prisma.transfer.update.mockResolvedValue(createTransfer({ status: TransferStatus.DECLINED }));

    const result = await service.reject(receiver, "transfer-1");

    expect(result.status).toBe(TransferStatus.DECLINED);
    expect(prisma.transfer.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: TransferStatus.DECLINED })
    }));
  });

  it("allows the sender to cancel a pending transfer", async () => {
    const { service, prisma } = createService();
    prisma.transfer.findUnique.mockResolvedValue(createTransfer());
    prisma.transfer.update.mockResolvedValue(createTransfer({ status: TransferStatus.CANCELLED }));

    const result = await service.cancel(sender, "transfer-1");

    expect(result.status).toBe(TransferStatus.CANCELLED);
  });
});
