import { BadRequestException } from "@nestjs/common";
import { NotificationEvent, TicketStatus, TransferStatus, UserRole } from "@prisma/client";
import * as QRCode from "qrcode";
import { TransfersService } from "./transfers.service";

jest.mock("qrcode", () => ({
  toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,new-qr")
}));

const sender = {
  id: "sender-1",
  tenantId: null,
  email: "sender@example.com",
  emailVerified: true,
  role: UserRole.CUSTOMER
};

const receiver = {
  id: "receiver-1",
  tenantId: null,
  email: "receiver@example.com",
  emailVerified: true,
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
      endsAt: null,
      allowTicketTransfer: true,
      ticketTransferLockTime: null
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
      updateMany: jest.fn()
    },
    transfer: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    transferHistory: {
      create: jest.fn(),
      createMany: jest.fn()
    },
    $transaction: jest.fn((input) => Array.isArray(input) ? Promise.all(input) : input(prisma))
  };
  const audit = { log: jest.fn().mockResolvedValue({}) };
  const notifications = { send: jest.fn().mockResolvedValue({}), sendTicketTransferDelivered: jest.fn().mockResolvedValue({}) };
  const config = { get: jest.fn().mockReturnValue("test-secret") };
  const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
  const service = new TransfersService(prisma as any, audit as any, notifications as any, cache as any, config as any);
  return { service, prisma, audit, notifications, cache };
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

    const result = await service.create(sender, { ticketId: "ticket-1", receiverEmail: receiver.email, confirmation: "CONFIRMAR" });

    expect(result.status).toBe(TransferStatus.PENDING);
    expect(prisma.transfer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ticketId: "ticket-1",
        senderId: sender.id,
        receiverId: receiver.id,
        history: {
          create: expect.objectContaining({
            metadata: {
              receiverEmail: receiver.email,
              receiverId: receiver.id
            }
          })
        }
      })
    }));
    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
      event: NotificationEvent.TICKET_TRANSFER_RECEIVED,
      recipient: receiver.email,
      dedupeKey: "ticket-transfer-received:transfer-1",
      mail: expect.objectContaining({ subject: expect.any(String), html: expect.any(String) })
    }));
  });

  it("limits the transfer lifetime to the event transfer lock time", async () => {
    const { service, prisma } = createService();
    const lockTime = new Date(Date.now() + 1000 * 60 * 60);
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email, avatarUrl: null });
    prisma.ticket.findFirst.mockResolvedValue(createTicket({
      event: { ...createTicket().event, ticketTransferLockTime: lockTime }
    }));
    prisma.transfer.findFirst.mockResolvedValue(null);
    prisma.transfer.create.mockResolvedValue(createTransfer({ expiresAt: lockTime }));

    await service.create(sender, { ticketId: "ticket-1", receiverEmail: receiver.email, confirmation: "CONFIRMAR" });

    expect(prisma.transfer.create.mock.calls[0][0].data.expiresAt).toEqual(lockTime);
  });

  it("blocks duplicate pending transfers for the same ticket", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email, avatarUrl: null });
    prisma.ticket.findFirst.mockResolvedValue(createTicket());
    prisma.transfer.findFirst.mockResolvedValue(createTransfer());

    await expect(service.create(sender, { ticketId: "ticket-1", receiverEmail: receiver.email, confirmation: "CONFIRMAR" })).rejects.toThrow(BadRequestException);
  });

  it("turns a database race for a pending transfer into a friendly conflict", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email, avatarUrl: null });
    prisma.ticket.findFirst.mockResolvedValue(createTicket());
    prisma.transfer.findFirst.mockResolvedValue(null);
    prisma.transfer.create.mockRejectedValue({ code: "P2002" });

    await expect(
      service.create(sender, { ticketId: "ticket-1", receiverEmail: receiver.email, confirmation: "CONFIRMAR" })
    ).rejects.toThrow("Ja existe uma transferencia pendente");
  });

  it("blocks transfers for used tickets", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email, avatarUrl: null });
    prisma.ticket.findFirst.mockResolvedValue(createTicket({ status: TicketStatus.USED, usedAt: new Date() }));

    await expect(service.create(sender, { ticketId: "ticket-1", receiverEmail: receiver.email, confirmation: "CONFIRMAR" })).rejects.toThrow(BadRequestException);
  });

  it("requires the CONFIRMAR phrase before creating a transfer", async () => {
    const { service, prisma } = createService();

    await expect(
      service.create(sender, { ticketId: "ticket-1", receiverEmail: receiver.email, confirmation: "cancelar" }),
    ).rejects.toThrow("Digite CONFIRMAR");
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("accepts a transfer, changes ticket owner, and regenerates QR data", async () => {
    const { service, prisma } = createService();
    prisma.transfer.findUnique
      .mockResolvedValueOnce(createTransfer())
      .mockResolvedValueOnce(createTransfer({ ticket: createTicket(), sender: { id: sender.id, email: sender.email } }));
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email });
    prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
    prisma.transfer.update.mockResolvedValue(createTransfer({ status: TransferStatus.ACCEPTED }));

    const result = await service.accept(receiver, "transfer-1");

    expect(result.status).toBe(TransferStatus.ACCEPTED);
    expect(QRCode.toDataURL).toHaveBeenCalled();
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ticket-1", status: TicketStatus.AVAILABLE },
      data: expect.objectContaining({
        ownerId: receiver.id,
        attendeeEmail: receiver.email,
        qrCodeDataUrl: "data:image/png;base64,new-qr"
      })
    }));
    expect(prisma.transfer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "transfer-1", status: TransferStatus.PENDING })
    }));
  });

  it("does not transfer a ticket that became unavailable while the recipient was accepting", async () => {
    const { service, prisma } = createService();
    prisma.transfer.findUnique
      .mockResolvedValueOnce(createTransfer())
      .mockResolvedValueOnce(createTransfer({ ticket: createTicket(), sender: { id: sender.id, email: sender.email } }));
    prisma.user.findUnique.mockResolvedValue({ id: receiver.id, name: "Receiver", email: receiver.email });
    prisma.ticket.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.accept(receiver, "transfer-1")).rejects.toThrow("ficou indisponível");
    expect(prisma.transfer.update).not.toHaveBeenCalled();
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

  it("expires pending transfers in batch before listing received transfers", async () => {
    const { service, prisma, notifications } = createService();
    const expired = createTransfer({
      id: "expired-transfer-1",
      expiresAt: new Date(Date.now() - 1000),
      sender: { id: sender.id, name: "Sender", email: sender.email }
    });
    prisma.transfer.findMany
      .mockResolvedValueOnce([expired])
      .mockResolvedValueOnce([]);
    prisma.transfer.update.mockResolvedValue(createTransfer({ status: TransferStatus.EXPIRED }));

    await service.received(receiver, {});

    expect(prisma.transfer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "expired-transfer-1", status: TransferStatus.PENDING }),
      data: {
        status: TransferStatus.EXPIRED,
        history: { create: { action: "TRANSFER_EXPIRED", userId: sender.id } }
      }
    }));
    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
      event: NotificationEvent.TICKET_TRANSFER_EXPIRED,
      recipient: sender.email
    }));
  });

  it("skips expiring transfers when a recent expiration pass is cached", async () => {
    const { service, prisma, cache } = createService();
    cache.get.mockResolvedValue({ startedAt: Date.now() });
    prisma.transfer.findMany.mockResolvedValueOnce([]);

    await service.received(receiver, {});

    expect(prisma.transfer.update).not.toHaveBeenCalled();
  });

  it("does not record or notify an expiration that lost a concurrent state change", async () => {
    const { service, prisma, notifications } = createService();
    prisma.transfer.findMany.mockResolvedValueOnce([
      createTransfer({ expiresAt: new Date(Date.now() - 1000) })
    ]).mockResolvedValueOnce([]);
    prisma.transfer.update.mockRejectedValueOnce({ code: "P2025" });

    await service.received(receiver, {});

    expect(notifications.send).not.toHaveBeenCalled();
  });
});

describe("TransfersService ownership by e-mail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not look up guest tickets by e-mail when the sender e-mail is unverified", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(null);

    await expect(
      service.create({ ...sender, emailVerified: false }, {
        ticketId: "ticket-1",
        receiverEmail: receiver.email,
        confirmation: "CONFIRMAR"
      })
    ).rejects.toThrow();

    const where = prisma.ticket.findFirst.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain("buyerEmail");
    expect(JSON.stringify(where)).not.toContain("attendeeEmail");
  });

});

describe("TransfersService resolveRecipient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("nao devolve o e-mail nem o nome completo de quem foi encontrado pelo e-mail", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: "receiver-1",
      name: "Maria Aparecida Souza",
      email: "maria.aparecida@gmail.com",
      avatarUrl: null
    });

    const result = await service.resolveRecipient(sender, { receiverEmail: "maria.aparecida@gmail.com" });

    expect(result.exists).toBe(true);
    expect(result.user).toEqual({ name: "Maria A. S.", email: "ma****@gmail.com" });
    expect(JSON.stringify(result)).not.toContain("Aparecida Souza");
    expect((result.user as any).id).toBeUndefined();
  });
});
