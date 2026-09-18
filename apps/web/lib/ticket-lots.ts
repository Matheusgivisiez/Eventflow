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

  // Numero do lote = posicao cronologica (startsAt), nunca a posicao no array da API,
  // que pode vir ordenado por preco (empate de preco => ordem aleatoria).
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
