import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CheckInStatus, EventStatus, PaymentStatus, TicketOrigin, TicketStatus } from "@prisma/client";
import { ValidateTicketUseCase } from "../checkin/use-cases/validate-ticket.use-case";
import { CourtesyService } from "./courtesy.service";

const qrSecret = "test-qrcode-secret-with-32-characters";
const admin = { id: "admin-1" };

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    title: "Hallowparty",
    tenantId: "tenant-producer",
    status: EventStatus.PUBLISHED,
    startsAt: new Date(Date.now() + 86_400_000),
    endsAt: null,
    ...overrides
  };
}

function createService() {
  let orderSeq = 0;
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(createEvent()) },
    ticketType: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "type-vip" }),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    order: {
      create: jest.fn().mockImplementation(async () => ({ id: `order-${++orderSeq}` })),
      update: jest.fn()
    },
    payment: { create: jest.fn() },
    ledgerEntry: { create: jest.fn() },
    ticket: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0)
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    notificationLog: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((callback) => callback(prisma))
  };
  const config = { get: jest.fn((key: string) => (key === "QR_CODE_SECRET" ? qrSecret : key === "APP_URL" ? "https://eventflow.test" : undefined)) };
  const payments = { dispatchPurchaseConfirmed: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue({}) };
  const cache = { del: jest.fn().mockResolvedValue(undefined) };
  const wallet = { deactivateTicket: jest.fn().mockResolvedValue(undefined) };
  const service = new CourtesyService(prisma as any, config as any, payments as any, audit as any, cache as any, wallet as any);
  return { service, prisma, payments, audit, cache, wallet, config };
}

describe("CourtesyService.issue", () => {
  it("emite VIP da plataforma como pedido pago de valor zero, sem pagamento, extrato ou estoque", async () => {
    const { service, prisma } = createService();

    const result = await service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, {
      guests: [{ name: "  Ana   Convidada ", email: "ANA@Example.com", quantity: 2 }]
    });

    expect(result.issuedTickets).toBe(2);
    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventId: "event-1",
        buyerName: "Ana Convidada",
        buyerEmail: "ana@example.com",
        totalCents: 0,
        feeCents: 0,
        status: PaymentStatus.PAID,
        origin: TicketOrigin.PLATFORM_COURTESY,
        issuedById: "admin-1",
        orderAccessToken: expect.stringMatching(/^[A-Za-z0-9_-]{40,}$/),
        items: { create: { ticketTypeId: "type-vip", quantity: 2, unitCents: 0, totalCents: 0 } }
      })
    }));
    const tickets = prisma.ticket.createMany.mock.calls[0][0].data;
    expect(tickets).toHaveLength(2);
    expect(tickets.every((ticket: any) => ticket.origin === TicketOrigin.PLATFORM_COURTESY && ticket.attendeeEmail === "ana@example.com")).toBe(true);
    expect(new Set(tickets.map((ticket: any) => ticket.uuid)).size).toBe(2);

    // Nada financeiro e nenhum lote do produtor é tocado.
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    expect(prisma.ticketType.update).not.toHaveBeenCalled();
    expect(prisma.ticketType.updateMany).not.toHaveBeenCalled();
  });

  it("cria o tipo interno fora de venda e sem estoque, com o nome informado", async () => {
    const { service, prisma } = createService();

    await service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, { label: "Imprensa", guests: [{ name: "Leo", email: "leo@example.com" }] });

    expect(prisma.ticketType.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: "event-1", origin: TicketOrigin.PLATFORM_COURTESY, name: "Imprensa" }
    }));
    expect(prisma.ticketType.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Imprensa",
        origin: TicketOrigin.PLATFORM_COURTESY,
        isActive: false,
        quantity: 0,
        sold: 0,
        priceCents: 0
      })
    }));
  });

  it("reaproveita o tipo interno existente e usa o nome padrão de cada origem", async () => {
    const { service, prisma } = createService();
    prisma.ticketType.findFirst.mockResolvedValue({ id: "type-existing" });

    await service.issue("event-1", TicketOrigin.ORGANIZER_COURTESY, { id: "owner-1" }, { guests: [{ name: "Bia", email: "bia@example.com" }] });

    expect(prisma.ticketType.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: "event-1", origin: TicketOrigin.ORGANIZER_COURTESY, name: "Cortesia" }
    }));
    expect(prisma.ticketType.create).not.toHaveBeenCalled();
    expect(prisma.ticket.createMany.mock.calls[0][0].data[0]).toMatchObject({ ticketTypeId: "type-existing", origin: TicketOrigin.ORGANIZER_COURTESY });
  });

  it("gera um QR Code que a portaria aceita como qualquer ingresso vendido", async () => {
    const { service, prisma, config } = createService();
    await service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, { guests: [{ name: "Ana", email: "ana@example.com" }] });
    const issued = prisma.ticket.createMany.mock.calls[0][0].data[0];

    const checkinPrisma = {
      ticket: {
        findFirst: jest.fn().mockResolvedValue({
          ...issued,
          id: "ticket-1",
          status: TicketStatus.AVAILABLE,
          usedAt: null,
          event: { id: "event-1", tenantId: "tenant-producer", status: EventStatus.PUBLISHED, startsAt: new Date(Date.now() - 60_000), checkInOpensAt: null, checkInClosesAt: null },
          ticketType: { id: "type-vip", name: "Convidado VIP" },
          order: { id: issued.orderId, status: PaymentStatus.PAID }
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      checkInLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const validate = new ValidateTicketUseCase(checkinPrisma as any, config as any);
    const payload = JSON.stringify({ uuid: issued.uuid, orderId: issued.orderId, signature: issued.signature });

    const result = await validate.execute("event-1", "tenant-producer", "operator-1", payload);

    expect(result.status).toBe(CheckInStatus.ENTERED);
  });

  it("envia o ingresso por e-mail para cada convidado depois de gravar", async () => {
    const { service, payments } = createService();
    await service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, {
      guests: [{ name: "Ana", email: "ana@example.com" }, { name: "Leo", email: "leo@example.com" }]
    });
    expect(payments.dispatchPurchaseConfirmed.mock.calls.map((call) => call[0])).toEqual(["order-1", "order-2"]);
  });

  it("não envia e-mail quando o emissor desliga o envio", async () => {
    const { service, payments } = createService();
    await service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, { sendEmail: false, guests: [{ name: "Ana", email: "ana@example.com" }] });
    expect(payments.dispatchPurchaseConfirmed).not.toHaveBeenCalled();
  });

  it("registra na auditoria quem emitiu, para quem e quantos", async () => {
    const { service, audit } = createService();
    await service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, { note: "Patrocinador", guests: [{ name: "Ana", email: "ana@example.com", quantity: 3 }] });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      userId: "admin-1",
      action: "courtesy.issued",
      entityId: "event-1",
      metadata: expect.objectContaining({ origin: TicketOrigin.PLATFORM_COURTESY, ticketCount: 3, note: "Patrocinador", guests: [{ email: "ana@example.com", quantity: 3 }] })
    }));
  });

  it("só invalida o painel do organizador quando a cortesia é dele", async () => {
    const platform = createService();
    await platform.service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, { guests: [{ name: "Ana", email: "ana@example.com" }] });
    expect(platform.cache.del).not.toHaveBeenCalled();

    const organizer = createService();
    await organizer.service.issue("event-1", TicketOrigin.ORGANIZER_COURTESY, { id: "owner-1" }, { guests: [{ name: "Ana", email: "ana@example.com" }] });
    expect(organizer.cache.del).toHaveBeenCalledWith("dashboard:tenant-producer");
  });

  it("recusa evento inexistente, encerrado ou já terminado", async () => {
    const { service, prisma } = createService();
    const dto = { guests: [{ name: "Ana", email: "ana@example.com" }] };

    prisma.event.findUnique.mockResolvedValueOnce(null);
    await expect(service.issue("missing", TicketOrigin.PLATFORM_COURTESY, admin, dto)).rejects.toBeInstanceOf(NotFoundException);

    prisma.event.findUnique.mockResolvedValueOnce(createEvent({ status: EventStatus.CLOSED }));
    await expect(service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, dto)).rejects.toBeInstanceOf(BadRequestException);

    prisma.event.findUnique.mockResolvedValueOnce(createEvent({ startsAt: new Date(Date.now() - 3 * 86_400_000), endsAt: new Date(Date.now() - 2 * 86_400_000) }));
    await expect(service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, dto)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("continua emitindo durante o evento quando não há horário de término cadastrado", async () => {
    const { service, prisma } = createService();
    prisma.event.findUnique.mockResolvedValueOnce(createEvent({ startsAt: new Date(Date.now() - 2 * 3_600_000), endsAt: null }));
    await expect(service.issue("event-1", TicketOrigin.PLATFORM_COURTESY, admin, { guests: [{ name: "Ana", email: "ana@example.com" }] })).resolves.toMatchObject({ issuedTickets: 1 });
  });
});

describe("CourtesyService.list", () => {
  it("resume emitidos, entradas e cancelados e só consulta a origem pedida", async () => {
    const { service, prisma } = createService();
    prisma.ticket.groupBy.mockResolvedValue([
      { status: TicketStatus.AVAILABLE, _count: { _all: 4 } },
      { status: TicketStatus.USED, _count: { _all: 3 } },
      { status: TicketStatus.CANCELED, _count: { _all: 1 } }
    ]);
    prisma.ticket.findMany.mockResolvedValue([{
      id: "ticket-1", uuid: "aaaabbbb-cccc-dddd-eeee-ffff00001111", attendeeName: "Ana", attendeeEmail: "ana@example.com",
      status: TicketStatus.USED, usedAt: new Date(), createdAt: new Date(),
      ticketType: { name: "Convidado VIP" }, order: { id: "order-1", orderAccessToken: "tok", issuedById: "admin-1" }
    }]);
    prisma.user.findMany.mockResolvedValue([{ id: "admin-1", name: "Riquelmy" }]);
    prisma.notificationLog.findMany.mockResolvedValue([{ dedupeKey: "purchase-confirmed:order-1", status: "SENT" }]);

    const result = await service.list("event-1", TicketOrigin.PLATFORM_COURTESY);

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: "event-1", origin: TicketOrigin.PLATFORM_COURTESY } }));
    expect(result.summary).toEqual({ issued: 7, checkedIn: 3, pending: 4, canceled: 1 });
    expect(result.tickets[0]).toMatchObject({
      code: "AAAABBBBCC",
      guestName: "Ana",
      label: "Convidado VIP",
      issuedBy: "Riquelmy",
      emailStatus: "SENT",
      ticketUrl: "https://eventflow.test/checkout/success?orderId=order-1&accessToken=tok"
    });
  });
});

describe("CourtesyService.cancel", () => {
  it("cancela ingresso disponível e encerra o pedido quando não sobra nenhum", async () => {
    const { service, prisma, wallet, audit } = createService();
    prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1", uuid: "uuid-1", status: TicketStatus.AVAILABLE, orderId: "order-1", eventId: "event-1", event: { tenantId: "tenant-producer" } });

    const result = await service.cancel("ticket-1", TicketOrigin.PLATFORM_COURTESY, admin);

    expect(result.status).toBe(TicketStatus.CANCELED);
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({ where: { id: "ticket-1", status: TicketStatus.AVAILABLE }, data: { status: TicketStatus.CANCELED } });
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: PaymentStatus.CANCELED } });
    expect(wallet.deactivateTicket).toHaveBeenCalledWith("uuid-1");
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "courtesy.canceled", entityId: "ticket-1" }));
  });

  it("mantém o pedido pago enquanto ainda há outro ingresso válido nele", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1", uuid: "uuid-1", status: TicketStatus.AVAILABLE, orderId: "order-1", eventId: "event-1", event: { tenantId: "t" } });
    prisma.ticket.count.mockResolvedValue(1);
    await service.cancel("ticket-1", TicketOrigin.PLATFORM_COURTESY, admin);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("não cancela ingresso que já entrou", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1", uuid: "uuid-1", status: TicketStatus.USED, orderId: "order-1", eventId: "event-1", event: { tenantId: "t" } });
    await expect(service.cancel("ticket-1", TicketOrigin.PLATFORM_COURTESY, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("a rota do organizador não alcança ingresso da plataforma nem de outro evento", async () => {
    const { service, prisma } = createService();
    prisma.ticket.findFirst.mockResolvedValue(null);

    await expect(service.cancel("ticket-vip", TicketOrigin.ORGANIZER_COURTESY, { id: "owner-1" }, "event-1")).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ticket-vip", origin: TicketOrigin.ORGANIZER_COURTESY, eventId: "event-1" }
    }));
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });
});
