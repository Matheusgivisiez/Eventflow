import { getVisibleTicketLots, markOpenedLots, type LotLike } from "./ticket-lots";

const now = new Date("2026-10-07T23:30:00Z");
const lot = (id: string, startsAt: string, quantity: number, sold: number, extra: Partial<LotLike> = {}): LotLike => ({
  id,
  quantity,
  sold,
  startsAt: new Date(startsAt),
  endsAt: new Date("2099-01-01T00:00:00Z"),
  isActive: true,
  salesEndQuantity: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  openedAt: null,
  ...extra
});
const state = (lots: LotLike[], at = now) =>
  getVisibleTicketLots(lots, at).map(({ ticketType, status, availableQuantity }) => [ticketType.id, status, availableQuantity]);

describe("getVisibleTicketLots", () => {
  it("mantém a fila: um lote à venda por vez e virada quando esgota", () => {
    expect(state([lot("escuro", "2026-10-07T18:00:00Z", 50, 10), lot("lote-1", "2026-10-07T18:00:00Z", 130, 0)])).toEqual([["escuro", "current", 40]]);
    expect(state([lot("escuro", "2026-10-07T18:00:00Z", 50, 50), lot("lote-1", "2026-10-20T12:00:00Z", 130, 0)])).toEqual([
      ["escuro", "past", 0],
      ["lote-1", "current", 130]
    ]);
  });

  it("não abre nada antes do horário do 1º lote", () => {
    expect(state([lot("escuro", "2026-10-08T18:00:00Z", 50, 0), lot("lote-1", "2026-10-09T18:00:00Z", 130, 0)])).toEqual([]);
  });

  it("leva o saldo do lote encerrado por data para o seguinte", () => {
    const ended = lot("escuro", "2026-10-01T12:00:00Z", 100, 30, { endsAt: new Date("2026-10-05T00:00:00Z") });
    expect(state([ended, lot("lote-1", "2026-10-20T12:00:00Z", 100, 0)])).toEqual([
      ["escuro", "past", 0],
      ["lote-1", "current", 170]
    ]);
  });

  it("ingresso que volta ao lote esgotado não fecha o lote seguinte", () => {
    expect(state([lot("escuro", "2026-10-07T18:00:00Z", 50, 49), lot("lote-1", "2026-10-20T12:00:00Z", 130, 5)])).toEqual([
      ["escuro", "current", 1],
      ["lote-1", "current", 125]
    ]);
  });

  it("vendido o ingresso devolvido, o lote volta a esgotado e o seguinte segue aberto", () => {
    expect(state([lot("escuro", "2026-10-07T18:00:00Z", 50, 50), lot("lote-1", "2026-10-20T12:00:00Z", 130, 5)])).toEqual([
      ["escuro", "past", 0],
      ["lote-1", "current", 125]
    ]);
  });

  it("mantém aberto o lote seguinte marcado como aberto mesmo sem nenhuma venda", () => {
    const opened = lot("lote-1", "2026-10-20T12:00:00Z", 130, 0, { openedAt: new Date("2026-10-07T22:00:00Z") });
    expect(state([lot("escuro", "2026-10-07T18:00:00Z", 50, 49), opened])).toEqual([
      ["escuro", "current", 1],
      ["lote-1", "current", 130]
    ]);
  });

  it("lote do meio esgotado aparece esgotado e lote que nunca abriu continua fechado", () => {
    const lots = [
      lot("escuro", "2026-10-07T18:00:00Z", 50, 49),
      lot("lote-1", "2026-10-08T12:00:00Z", 130, 130),
      lot("lote-2", "2026-10-09T12:00:00Z", 170, 2),
      lot("lote-3", "2026-10-10T12:00:00Z", 150, 0)
    ];
    expect(state(lots)).toEqual([
      ["escuro", "current", 1],
      ["lote-1", "past", 0],
      ["lote-2", "current", 168]
    ]);
  });

  it("não reabre lote já aberto que encerrou por data ou bateu o limite de vendas", () => {
    const ended = lot("lote-1", "2026-10-07T19:00:00Z", 130, 5, { endsAt: new Date("2026-10-07T20:00:00Z") });
    const capped = lot("lote-2", "2026-10-07T20:00:00Z", 170, 20, { salesEndQuantity: 20 });
    expect(state([lot("escuro", "2026-10-07T18:00:00Z", 50, 49), ended, capped])).toEqual([
      ["escuro", "current", 1],
      ["lote-1", "past", 0],
      ["lote-2", "past", 0]
    ]);
  });
});

describe("markOpenedLots", () => {
  const store = (lots: LotLike[]) => ({
    ticketType: {
      findMany: jest.fn(async () => lots),
      updateMany: jest.fn(async () => ({ count: 1 }))
    }
  });

  it("marca o lote seguinte no momento em que o anterior esgota", async () => {
    const prisma = store([
      lot("escuro", "2026-10-07T18:00:00Z", 50, 50, { openedAt: new Date("2026-10-07T18:00:00Z") }),
      lot("lote-1", "2026-10-20T12:00:00Z", 130, 0)
    ]);
    await expect(markOpenedLots(prisma, "event-1", now)).resolves.toEqual(["lote-1"]);
    expect(prisma.ticketType.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["lote-1"] }, openedAt: null }, data: { openedAt: now } });
  });

  it("não grava nada quando os lotes abertos já estão marcados", async () => {
    const prisma = store([
      lot("escuro", "2026-10-07T18:00:00Z", 50, 10, { openedAt: new Date("2026-10-07T18:00:00Z") }),
      lot("lote-1", "2026-10-20T12:00:00Z", 130, 0)
    ]);
    await expect(markOpenedLots(prisma, "event-1", now)).resolves.toEqual([]);
    expect(prisma.ticketType.updateMany).not.toHaveBeenCalled();
  });
});
