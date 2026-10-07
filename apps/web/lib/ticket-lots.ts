import type { TicketType } from "@/types/eventflow";

export type VisibleTicketLot = {
  ticket: TicketType;
  status: "past" | "current";
  available: number;
  lotNumber: number;
};

export function getVisibleTicketLots(ticketTypes: TicketType[], now = new Date()): VisibleTicketLot[] {
  const orderedLots = ticketTypes
    .filter((ticket) => ticket.isActive)
    .map((ticket, index) => ({ ticket, originalIndex: index }))
    .sort((a, b) => new Date(a.ticket.startsAt).getTime() - new Date(b.ticket.startsAt).getTime() || a.originalIndex - b.originalIndex);

  const visibleLots: VisibleTicketLot[] = [];
  let cumulativeQuantity = 0;
  let cumulativeSold = 0;
  // O 1º lote só abre no horário programado (startsAt). Os seguintes abrem no próprio
  // horário ou antes, assim que o lote anterior esgota ou encerra (virada de lote).
  let previousLotsClosed = false;

  // Número do lote = posição cronológica (startsAt), nunca a posição no array da API,
  // que pode vir ordenado por preço (empate de preço => ordem aleatória).
  for (const [position, { ticket }] of orderedLots.entries()) {
    cumulativeQuantity += ticket.quantity;
    cumulativeSold += ticket.sold;

    const available = Math.max(0, cumulativeQuantity - cumulativeSold);
    const hasStarted = now >= new Date(ticket.startsAt);
    const hasEnded = now > new Date(ticket.endsAt);
    const reachedSalesLimit = typeof ticket.salesEndQuantity === "number" && ticket.sold >= ticket.salesEndQuantity;
    const soldOut = available <= 0 || reachedSalesLimit;
    const canOpen = (hasStarted || previousLotsClosed) && !hasEnded && !soldOut;

    if (canOpen) {
      visibleLots.push({ ticket, status: "current", available, lotNumber: position + 1 });
      break;
    }

    if (hasStarted || hasEnded || soldOut) {
      visibleLots.push({ ticket, status: "past", available: 0, lotNumber: position + 1 });
    }

    previousLotsClosed = hasEnded || soldOut;
  }

  return visibleLots;
}

export function getCurrentTicketLots(ticketTypes: TicketType[], now = new Date()) {
  return getVisibleTicketLots(ticketTypes, now).filter((lot) => lot.status === "current");
}

/**
 * Lote programado que ainda não abriu: existe só enquanto nenhum lote está à venda
 * e o 1º lote ativo ainda não chegou ao horário de início. null nos demais casos.
 */
export function getUpcomingTicketLot(ticketTypes: TicketType[], now = new Date()): TicketType | null {
  if (getVisibleTicketLots(ticketTypes, now).length) return null;
  const [firstLot] = ticketTypes
    .filter((ticket) => ticket.isActive)
    .map((ticket, index) => ({ ticket, index }))
    .sort((a, b) => new Date(a.ticket.startsAt).getTime() - new Date(b.ticket.startsAt).getTime() || a.index - b.index);
  if (!firstLot || now >= new Date(firstLot.ticket.startsAt)) return null;
  return firstLot.ticket;
}

/**
 * Preço anunciado na vitrine: o do lote aberto agora, o mesmo que a página do
 * evento vende. Lotes esgotados ou encerrados não contam.
 * null = nenhum lote aberto (ou evento sem lotes): não anunciar preço.
 */
export function getCurrentLotPriceCents(ticketTypes: TicketType[], now = new Date()): number | null {
  const currentLots = getVisibleTicketLots(ticketTypes, now).filter((lot) => lot.status === "current");
  if (!currentLots.length) return null;
  return Math.min(...currentLots.map(({ ticket }) => ticket.priceCents));
}
