import { PaymentStatus } from "@prisma/client";
import { AdminService } from "./admin.service";

jest.mock("nanoid", () => ({ nanoid: jest.fn(() => "fixed-id") }));

function setup() {
  const prisma = {
    user: { findMany: jest.fn(), count: jest.fn() },
    event: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    payment: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
    order: { findMany: jest.fn(), groupBy: jest.fn() },
    orderItem: { groupBy: jest.fn() },
    ticket: { findMany: jest.fn() },
    ticketType: { findFirst: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
  };
  const eventsService = { findOne: jest.fn(), update: jest.fn(), createInviteLink: jest.fn() };
  const ticketsService = { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() };
  return { prisma, eventsService, ticketsService, service: new AdminService(prisma as never, eventsService as never, ticketsService as never) };
}

describe("AdminService contracts", () => {
  it("keeps the existing list endpoints as arrays of up to 100 full records", async () => {
    const { prisma, service } = setup();
    prisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
    prisma.event.findMany.mockResolvedValue([{ id: "event-1" }]);
    prisma.payment.findMany.mockResolvedValue([{ id: "payment-1" }]);

    expect(await service.users()).toEqual([{ id: "user-1" }]);
    expect(await service.events()).toEqual([{ id: "event-1" }]);
    expect(await service.payments(PaymentStatus.PAID)).toEqual([{ id: "payment-1" }]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, select: expect.objectContaining({ tenant: true }) }));
    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, include: expect.objectContaining({ ticketTypes: true }) }));
    expect(prisma.payment.findMany).toHaveBeenCalledWith({ where: { status: PaymentStatus.PAID }, include: { event: true, order: true }, orderBy: { createdAt: "desc" }, take: 100 });
  });

  it("filters payments in the new paginated endpoint without changing the legacy query", async () => {
    const { prisma, service } = setup();
    prisma.payment.findMany.mockResolvedValue([{ id: "payment-2" }]);
    prisma.payment.count.mockResolvedValue(31);

    expect(await service.paymentsPage(PaymentStatus.PAID, "event-1", "2")).toEqual({
      items: [{ id: "payment-2" }], total: 31, page: 2, pageSize: 30
    });
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: PaymentStatus.PAID, eventId: "event-1" }, skip: 30, take: 30
    }));
    expect(prisma.payment.count).toHaveBeenCalledWith({ where: { status: PaymentStatus.PAID, eventId: "event-1" } });
  });

  it("separates paid tickets from stock reserved in an event lot", async () => {
    const { prisma, service } = setup();
    prisma.event.findUnique.mockResolvedValue({ id: "event-1", ticketTypes: [{ id: "lot-1", sold: 5, quantity: 10 }] });
    prisma.order.groupBy.mockResolvedValue([]);
    prisma.payment.groupBy.mockResolvedValue([]);
    prisma.orderItem.groupBy.mockResolvedValue([{ ticketTypeId: "lot-1", _sum: { quantity: 3 } }]);

    const detail = await service.event("event-1");

    expect(detail.event.ticketTypes[0]).toEqual({ id: "lot-1", sold: 5, quantity: 10, paid: 3 });
    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { order: { eventId: "event-1", status: PaymentStatus.PAID } }
    }));
  });

  it("edits an event through its own tenant while recording the admin actor", async () => {
    const { prisma, eventsService, service } = setup();
    prisma.event.findUnique.mockResolvedValue({ tenantId: "other-tenant" });
    eventsService.update.mockResolvedValue({ id: "event-1", title: "Novo título" });

    await service.updateManagedEvent("event-1", { title: "Novo título" }, "admin-1");

    expect(eventsService.update).toHaveBeenCalledWith("event-1", "other-tenant", { title: "Novo título" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "admin-1", action: "admin.event.updated", entityId: "event-1"
    }) });
  });

  it("rejects a lot ID belonging to a different event", async () => {
    const { prisma, ticketsService, service } = setup();
    prisma.event.findUnique.mockResolvedValue({ tenantId: "tenant-1" });
    prisma.ticketType.findFirst.mockResolvedValue(null);

    await expect(service.updateManagedTicketType("event-1", "other-event-lot", { name: "Novo lote" }, "admin-1")).rejects.toThrow("Lote de ingresso não encontrado.");
    expect(ticketsService.update).not.toHaveBeenCalled();
  });
});
