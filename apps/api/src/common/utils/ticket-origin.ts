import { TicketOrigin } from "@prisma/client";

/**
 * Regras de visibilidade por origem do ingresso. Ficam em um só lugar porque
 * a garantia do produto depende de TODAS as consultas do organizador usarem o
 * mesmo critério: um convidado da plataforma não pode vazar por um contador
 * esquecido.
 *
 * - Vendas (receita, pedidos pagos, ingressos vendidos): só SALE.
 * - Público do evento visto pelo organizador (participantes, check-ins):
 *   vendas + cortesias que ele mesmo emitiu.
 * - PLATFORM_COURTESY: só o admin da plataforma enxerga, no painel dele.
 */
export const SALE_ONLY = { origin: TicketOrigin.SALE };

export const ORGANIZER_VISIBLE = { origin: { not: TicketOrigin.PLATFORM_COURTESY } };

export type CourtesyOrigin = Exclude<TicketOrigin, "SALE">;

export function isCourtesy(origin: TicketOrigin | null | undefined): boolean {
  return Boolean(origin) && origin !== TicketOrigin.SALE;
}

/** Nome padrão impresso no ingresso quando quem emite não informa outro. */
export function defaultCourtesyLabel(origin: CourtesyOrigin): string {
  return origin === TicketOrigin.PLATFORM_COURTESY ? "Convidado VIP" : "Cortesia";
}
