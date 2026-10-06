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
  let previousLotsClosed = true;

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

export function getCurrentTicketLots(ticketTypes: TicketType[]) {
  return getVisibleTicketLots(ticketTypes).filter((lot) => lot.status === "current");
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
