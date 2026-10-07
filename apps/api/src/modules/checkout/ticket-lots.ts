import { SALE_ONLY } from "../../common/utils/ticket-origin";
import { hasReachedSalesEnd } from "./sales-limit";

export type LotLike = {
  id: string;
  quantity: number;
  sold: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  salesEndQuantity?: number | null;
  createdAt?: Date | null;
  openedAt?: Date | null;
};

export type VisibleTicketLot<T extends LotLike> = {
  ticketType: T;
  status: "past" | "current";
  availableQuantity: number;
};

/**
 * Lote que já esteve à venda. `openedAt` é gravado quando o lote abre (ver
 * markOpenedLots); `sold > 0` cobre lotes anteriores à coluna e qualquer falha
 * ao gravar a marca, já que só um lote aberto recebe reserva.
 */
export function wasLotOpened(lot: Pick<LotLike, "sold" | "openedAt">): boolean {
  return lot.openedAt != null || lot.sold > 0;
}

/**
 * Quais lotes aparecem na venda e quais estão abertos agora.
 *
 * Os lotes abrem em fila: o 1º só no horário programado (startsAt); os seguintes no
 * próprio horário ou antes, assim que o anterior esgota ou encerra (virada de lote).
 *
 * Lote que já abriu não fecha mais por causa de um lote anterior. Se um ingresso
 * volta ao lote anterior (pedido vencido ou cancelado), os dois ficam à venda juntos:
 * o anterior com o saldo que voltou e o seguinte como estava. Quando o saldo devolvido
 * é vendido, o lote anterior volta a esgotado.
 *
 * O saldo é acumulado (lote encerrado por data leva o saldo para o seguinte), então
 * cada lote aberto desconta o que os lotes abertos antes dele já estão oferecendo,
 * para o mesmo ingresso não ser oferecido em dois lotes.
 *
 * Mantenha igual a apps/web/lib/ticket-lots.ts (a vitrine decide com a mesma regra).
 */
export function getVisibleTicketLots<T extends LotLike>(ticketTypes: T[], now: Date): VisibleTicketLot<T>[] {
  const orderedLots = [...ticketTypes]
    .filter((ticketType) => ticketType.isActive)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));

  const visibleLots: VisibleTicketLot<T>[] = [];
  let cumulativeQuantity = 0;
  let cumulativeSold = 0;
  let offeredByOpenLots = 0;
  let previousLotsClosed = false;
  let hasCurrentLot = false;

  for (const ticketType of orderedLots) {
    cumulativeQuantity += ticketType.quantity;
    cumulativeSold += ticketType.sold;

    const availableQuantity = Math.max(0, cumulativeQuantity - cumulativeSold - offeredByOpenLots);
    const hasStarted = now >= ticketType.startsAt;
    const hasEnded = now > ticketType.endsAt;
    const soldOut = availableQuantity <= 0 || hasReachedSalesEnd(ticketType.sold, ticketType.salesEndQuantity);
    const closed = hasEnded || soldOut;
    const alreadyOpened = wasLotOpened(ticketType);
    // Com um lote anterior à venda, só continua aberto quem já tinha aberto;
    // lote que nunca abriu espera a vez na fila.
    const opens = hasCurrentLot ? alreadyOpened : hasStarted || previousLotsClosed;

    if (opens && !closed) {
      visibleLots.push({ ticketType, status: "current", availableQuantity });
      offeredByOpenLots += availableQuantity;
      hasCurrentLot = true;
    } else if (hasCurrentLot ? alreadyOpened : hasStarted || closed) {
      visibleLots.push({ ticketType, status: "past", availableQuantity: 0 });
    }

    previousLotsClosed = closed;
  }

  return visibleLots;
}

type TicketTypeStore = {
  ticketType: {
    findMany(args: { where: Record<string, unknown> }): Promise<LotLike[]>;
    updateMany(args: { where: Record<string, unknown>; data: { openedAt: Date } }): Promise<unknown>;
  };
};

/**
 * Grava `openedAt` nos lotes que estão abertos agora e ainda não têm a marca.
 * Chamar depois de qualquer reserva de estoque já confirmada no banco: é a reserva
 * que esgota um lote e abre o seguinte, e a marca é o que mantém o seguinte aberto
 * se um ingresso do lote esgotado voltar antes da primeira venda dele.
 */
export async function markOpenedLots(prisma: TicketTypeStore, eventId: string, now = new Date()): Promise<string[]> {
  const lots = await prisma.ticketType.findMany({ where: { eventId, ...SALE_ONLY } });
  const openedNow = getVisibleTicketLots(lots, now)
    .filter((lot) => lot.status === "current" && !lot.ticketType.openedAt)
    .map((lot) => lot.ticketType.id);
  if (!openedNow.length) return [];

  await prisma.ticketType.updateMany({ where: { id: { in: openedNow }, openedAt: null }, data: { openedAt: now } });
  return openedNow;
}
