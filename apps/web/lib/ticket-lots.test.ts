import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCurrentLotPriceCents, getCurrentTicketLots, getUpcomingTicketLot, getVisibleTicketLots } from "./ticket-lots";
import type { TicketType } from "@/types/eventflow";

const lot = (id: string, startsAt: string, sold = 0) =>
  ({ id, name: id, isActive: true, quantity: 100, sold, priceCents: 100, startsAt, endsAt: "2099-01-01T00:00:00Z", limitPerBuy: 5 }) as unknown as TicketType;

describe("getVisibleTicketLots", () => {
  it("numera o lote pela ordem cronológica, não pela ordem do array", () => {
    const now = new Date("2026-09-17T20:00:00Z");
    // API devolve o 2º lote primeiro (empate de preço)
    const lots = getVisibleTicketLots([lot("lote-2", "2026-09-17T12:00:00Z"), lot("lote-1", "2026-09-16T12:00:00Z")], now);
    assert.equal(lots[0].ticket.id, "lote-1");
    assert.equal(lots[0].lotNumber, 1);
  });
});

describe("abertura programada do lote", () => {
  const opensAt = "2026-10-07T21:00:00Z"; // 18h de Brasília
  const before = new Date("2026-10-07T15:30:00Z");
  const atOpening = new Date(opensAt);

  it("mantém o 1º lote fechado antes do horário programado", () => {
    const lots = [lot("promocional", opensAt), lot("lote-1", opensAt)];
    assert.deepEqual(getVisibleTicketLots(lots, before), []);
    assert.deepEqual(getCurrentTicketLots(lots, before), []);
    assert.equal(getCurrentLotPriceCents(lots, before), null);
    assert.equal(getUpcomingTicketLot(lots, before)?.id, "promocional");
  });

  it("abre o 1º lote exatamente no horário programado", () => {
    const lots = [lot("promocional", opensAt), lot("lote-1", opensAt)];
    const current = getCurrentTicketLots(lots, atOpening);
    assert.deepEqual(current.map(({ ticket }) => ticket.id), ["promocional"]);
    assert.equal(getUpcomingTicketLot(lots, atOpening), null);
  });

  it("vira para o 2º lote antes do horário dele quando o 1º esgota", () => {
    const lots = [lot("promocional", "2026-10-07T12:00:00Z", 100), lot("lote-1", "2026-10-20T12:00:00Z")];
    const current = getCurrentTicketLots(lots, before);
    assert.deepEqual(current.map(({ ticket }) => ticket.id), ["lote-1"]);
    assert.equal(getUpcomingTicketLot(lots, before), null);
  });

  it("vira para o 2º lote quando o 1º encerra por data, levando o saldo", () => {
    const first = { ...lot("promocional", "2026-10-01T12:00:00Z", 30), endsAt: "2026-10-05T00:00:00Z" } as TicketType;
    const current = getCurrentTicketLots([first, lot("lote-1", "2026-10-20T12:00:00Z")], before);
    assert.deepEqual(current.map(({ ticket, available }) => [ticket.id, available]), [["lote-1", 170]]);
  });

  it("não considera lote inativo como programado", () => {
    const inactive = { ...lot("promocional", opensAt), isActive: false } as TicketType;
    assert.equal(getUpcomingTicketLot([inactive], before), null);
    assert.equal(getUpcomingTicketLot([], before), null);
  });
});

describe("getCurrentLotPriceCents", () => {
  const now = new Date("2026-10-07T15:00:00Z");
  const priced = (id: string, startsAt: string, priceCents: number, quantity: number, sold: number, extra: Partial<TicketType> = {}) =>
    ({ id, name: id, isActive: true, quantity, sold, priceCents, startsAt, endsAt: "2099-01-01T00:00:00Z", limitPerBuy: 5, ...extra }) as unknown as TicketType;

  it("anuncia o lote aberto, não o lote esgotado mais barato", () => {
    const lots = [priced("promocional", "2026-10-07T12:00:00Z", 4500, 50, 50), priced("lote-1", "2026-10-07T12:00:01Z", 5500, 130, 3)];
    assert.equal(getCurrentLotPriceCents(lots, now), 5500);
  });

  it("anuncia o primeiro lote enquanto ele tem ingressos", () => {
    const lots = [priced("promocional", "2026-10-07T12:00:00Z", 4500, 50, 10), priced("lote-1", "2026-10-07T12:00:01Z", 5500, 130, 0)];
    assert.equal(getCurrentLotPriceCents(lots, now), 4500);
  });

  it("não anuncia preço quando todos os lotes esgotaram", () => {
    const lots = [priced("promocional", "2026-10-07T12:00:00Z", 4500, 50, 50), priced("lote-1", "2026-10-07T12:00:01Z", 5500, 130, 130)];
    assert.equal(getCurrentLotPriceCents(lots, now), null);
  });

  it("não anuncia preço de lote encerrado por data", () => {
    const lots = [priced("promocional", "2026-10-01T12:00:00Z", 4500, 50, 10, { endsAt: "2026-10-05T00:00:00Z" })];
    assert.equal(getCurrentLotPriceCents(lots, now), null);
  });

  it("ignora lotes inativos e eventos sem lotes", () => {
    assert.equal(getCurrentLotPriceCents([], now), null);
    assert.equal(getCurrentLotPriceCents([priced("oculto", "2026-10-07T12:00:00Z", 1000, 10, 0, { isActive: false })], now), null);
  });

  it("mantém evento gratuito como preço zero", () => {
    assert.equal(getCurrentLotPriceCents([priced("gratis", "2026-10-07T12:00:00Z", 0, 10, 0)], now), 0);
  });
});
