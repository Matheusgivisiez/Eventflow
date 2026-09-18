import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getVisibleTicketLots } from "./ticket-lots";
import type { TicketType } from "@/types/eventflow";

const lot = (id: string, startsAt: string, sold = 0) =>
  ({ id, name: id, isActive: true, quantity: 100, sold, priceCents: 100, startsAt, endsAt: "2099-01-01T00:00:00Z", limitPerBuy: 5 }) as unknown as TicketType;

describe("getVisibleTicketLots", () => {
  it("numera o lote pela ordem cronologica, nao pela ordem do array", () => {
    const now = new Date("2026-09-17T20:00:00Z");
    // API devolve o 2º lote primeiro (empate de preco)
    const lots = getVisibleTicketLots([lot("lote-2", "2026-09-17T12:00:00Z"), lot("lote-1", "2026-09-16T12:00:00Z")], now);
    assert.equal(lots[0].ticket.id, "lote-1");
    assert.equal(lots[0].lotNumber, 1);
  });
});
