import { TicketOrigin } from "@prisma/client";
import { CheckInService } from "../../modules/checkin/checkin.service";
import { DashboardService } from "../../modules/dashboard/dashboard.service";
import { EventsRepository } from "../../modules/events/events.repository";
import { FinanceService } from "../../modules/finance/finance.service";
import { ParticipantsService } from "../../modules/participants/participants.service";
import { ReportsService } from "../../modules/reports/reports.service";
import { TicketsService } from "../../modules/tickets/tickets.service";

jest.mock("nanoid", () => ({ nanoid: jest.fn(() => "fixed-id") }));

/**
 * Garantia central do produto: nenhum número ou lista que o organizador
 * consulta pode incluir um convidado da plataforma (PLATFORM_COURTESY).
 *
 * Cada teste abaixo cobre uma tela do organizador e falha se alguma consulta
 * dela for feita sem o filtro de origem.
 */
const SALE = { origin: TicketOrigin.SALE };
const NOT_PLATFORM = { origin: { not: TicketOrigin.PLATFORM_COURTESY } };

/** Todas as cláusulas `where` com que um mock do Prisma foi chamado. */
function wheres(mock: jest.Mock) {
  return mock.mock.calls.map((call) => call[0]?.where);
}

describe("visibilidade do organizador por origem do ingresso", () => {
  it("painel: receita, pedidos e vendidos contam só vendas; entradas nunca contam VIP da plataforma", async () => {
    const prisma = {
      order: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalCents: 0, feeCents: 0 }, _count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([])
      },
      ticket: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockImplementation(async (args) =>
          args.where.origin === TicketOrigin.ORGANIZER_COURTESY
            ? [{ status: "AVAILABLE", _count: 4 }, { status: "USED", _count: 2 }]
            : [])
      },
      event: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      checkInLog: { count: jest.fn().mockResolvedValue(0) }
    };
    const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const service = new DashboardService(prisma as any, cache as any);

    const result: any = await service.summary("tenant-1");

    const orderWheres = [
      ...wheres(prisma.order.aggregate), ...wheres(prisma.order.findMany),
      ...wheres(prisma.order.count), ...wheres(prisma.order.groupBy)
    ];
    expect(orderWheres.length).toBeGreaterThanOrEqual(10);
    for (const where of orderWheres) expect(where).toMatchObject(SALE);

    for (const where of wheres(prisma.ticket.count)) expect(where).toMatchObject(SALE);
    expect(wheres(prisma.checkInLog.count)[0].ticket).toMatchObject(NOT_PLATFORM);

    // Nenhum agrupamento de ingressos inclui a origem da plataforma.
    for (const where of wheres(prisma.ticket.groupBy)) {
      expect([JSON.stringify(NOT_PLATFORM.origin), JSON.stringify(TicketOrigin.ORGANIZER_COURTESY)]).toContain(JSON.stringify(where.origin));
    }

    // Contagens por evento usam relação filtrada, nunca `tickets: true`.
    for (const call of prisma.event.findMany.mock.calls) {
      const count = call[0]?.select?._count?.select?.tickets;
      if (count !== undefined) expect(count.where?.origin).toBeDefined();
    }

    // A cortesia do próprio organizador aparece, em contador separado das vendas.
    expect(result.courtesyTickets).toBe(6);
    expect(result.courtesyCheckIns).toBe(2);
  });

  it("participantes: as duas listagens escondem VIP da plataforma", async () => {
    const prisma = {
      ticket: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((queries) => Promise.all(queries))
    };
    const service = new ParticipantsService(prisma as any);

    await service.list("tenant-1", { eventId: "event-1", search: "ana" });
    await service.listForOperations("tenant-1", { eventId: "event-1", search: "ana" });

    const all = [...wheres(prisma.ticket.findMany), ...wheres(prisma.ticket.count)];
    expect(all).toHaveLength(4);
    for (const where of all) expect(where).toMatchObject(NOT_PLATFORM);
  });

  it("histórico de entradas da portaria não lista VIP da plataforma", async () => {
    const prisma = { checkInLog: { findMany: jest.fn().mockResolvedValue([]) }, event: { findUnique: jest.fn() } };
    const service = new CheckInService({} as any, prisma as any);

    await service.list("event-1", "tenant-1");

    expect(wheres(prisma.checkInLog.findMany)[0].ticket).toMatchObject({ eventId: "event-1", ...NOT_PLATFORM });
  });

  it("relatórios: vendas só SALE; entradas e participantes sem VIP da plataforma", async () => {
    const prismaRead = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
      checkInLog: { count: jest.fn().mockResolvedValue(0) },
      ticket: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      analyticsEvent: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const service = new ReportsService({} as any, prismaRead as any, cache as any);

    await service.summary("tenant-1", { eventId: "event-1" });

    expect(wheres(prismaRead.order.findMany)[0]).toMatchObject(SALE);
    expect(wheres(prismaRead.ticket.count)[0]).toMatchObject(SALE);
    expect(wheres(prismaRead.checkInLog.count)[0].ticket).toMatchObject(NOT_PLATFORM);
    expect(wheres(prismaRead.ticket.findMany)[0]).toMatchObject(NOT_PLATFORM);
  });

  it("extrato do colaborador não lista pedidos de cortesia como venda", async () => {
    const prisma = {
      order: { aggregate: jest.fn().mockResolvedValue({ _sum: {} }), findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new FinanceService(prisma as any, {} as any);

    await service.teamSummary(["event-1"]);

    expect(wheres(prisma.order.aggregate)[0]).toMatchObject(SALE);
    expect(wheres(prisma.order.findMany)[0]).toMatchObject(SALE);
  });

  it("lotes: o tipo interno de cortesia nunca aparece como lote, nem para o organizador nem na vitrine", async () => {
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
      ticketType: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((queries) => Promise.all(queries))
    };
    const repository = new EventsRepository(prisma as any);

    await repository.list("tenant-1", { page: 1, perPage: 10 });
    await repository.list("tenant-1", { page: 1, perPage: 10, summary: true });
    await repository.list("tenant-1", { page: 1, perPage: 10, restricted: true, userId: "user-1" });
    await repository.findByIdForTenant("event-1", "tenant-1");
    await repository.findPublicBySlug("slug");
    await repository.findPublishedByInvite("slug", "hash");
    await repository.findPublicEvents({ page: 1, perPage: 12 });

    const ticketTypeFilters = [...prisma.event.findMany.mock.calls, ...prisma.event.findFirst.mock.calls]
      .map((call) => (call[0].include ?? call[0].select).ticketTypes);
    expect(ticketTypeFilters).toHaveLength(7);
    for (const filter of ticketTypeFilters) expect(filter.where).toMatchObject(SALE);

    const tickets = new TicketsService(prisma as any, {} as any);
    await tickets.list("event-1", "tenant-1");
    await expect(tickets.update("type-vip", "tenant-1", {} as any)).rejects.toThrow("Lote de ingresso não encontrado.");
    await expect(tickets.remove("type-vip", "tenant-1")).rejects.toThrow("Lote de ingresso não encontrado.");
    expect(wheres(prisma.ticketType.findMany)[0]).toMatchObject(SALE);
    for (const where of wheres(prisma.ticketType.findFirst)) expect(where).toMatchObject(SALE);
  });
});
