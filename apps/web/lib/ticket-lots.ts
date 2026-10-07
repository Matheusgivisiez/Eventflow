import type { TicketType } from "@/types/eventflow";

export type VisibleTicketLot = {
  ticket: TicketType;
  status: "past" | "current";
  available: number;
  /** Posição cronológica do lote (1 = o que abre primeiro). */
  lotNumber: number;
  /** Texto da etiqueta do lote ("1º Lote"); null = não exibir etiqueta numerada. */
  lotLabel: string | null;
};

const ORDINAL_WORDS: Record<string, number> = {
  primeiro: 1,
  segundo: 2,
  terceiro: 3,
  quarto: 4,
  quinto: 5,
  sexto: 6,
  setimo: 7,
  oitavo: 8,
  nono: 9,
  decimo: 10
};

function normalizeLotName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function namesItsOwnLot(name: string) {
  return /\blotes?\b/.test(normalizeLotName(name));
}

/**
 * Número que o próprio nome do lote declara: "1° LOTE", "1º lote", "Lote 2",
 * "lote-3", "Segundo lote". null quando o nome não traz número ("Lote no escuro", "Pista").
 */
export function getLotNumberFromName(name: string): number | null {
  const normalized = normalizeLotName(name);
  const digits =
    normalized.match(/(?<!\d)(\d{1,2})\s*[ºª°o.]?\s*lote\b/) ?? normalized.match(/\blote\s*(?:n[ºo°.]*\s*)?[-#]?\s*(\d{1,2})(?!\d)/);
  if (digits) {
    const value = Number(digits[1]);
    return value > 0 ? value : null;
  }
  const word = normalized.match(/\b([a-z]+)\s+lote\b/)?.[1];
  return word ? (ORDINAL_WORDS[word] ?? null) : null;
}

/**
 * Etiqueta numerada de cada lote.
 * - Se o produtor nomeia os lotes ("LOTE NO ESCURO", "1° LOTE"), vale o nome: a etiqueta
 *   repete o número que o nome declara e lote sem número no nome (lote surpresa) fica
 *   sem etiqueta. Nunca numeramos por conta própria nesse caso, para não contradizer o nome.
 * - Se nenhum lote se chama "lote" ("Pista", "Promocional"), numeramos pela ordem cronológica.
 */
function buildLotLabels(orderedNames: string[]): (string | null)[] {
  const producerNamesLots = orderedNames.some(namesItsOwnLot);
  return orderedNames.map((name, position) => {
    const lotNumber = producerNamesLots ? getLotNumberFromName(name) : position + 1;
    return lotNumber ? `${lotNumber}º Lote` : null;
  });
}

/**
 * Lote que já esteve à venda. A API grava `openedAt` quando o lote abre; `sold > 0`
 * cobre lotes anteriores a esse campo, já que só um lote aberto recebe reserva.
 */
function wasLotOpened(ticket: TicketType) {
  return ticket.openedAt != null || ticket.sold > 0;
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
 * Mantenha igual a apps/api/src/modules/checkout/ticket-lots.ts (o checkout valida
 * com a mesma regra).
 */
export function getVisibleTicketLots(ticketTypes: TicketType[], now = new Date()): VisibleTicketLot[] {
  const orderedLots = ticketTypes
    .filter((ticket) => ticket.isActive)
    .map((ticket, index) => ({ ticket, originalIndex: index }))
    .sort((a, b) => new Date(a.ticket.startsAt).getTime() - new Date(b.ticket.startsAt).getTime() || a.originalIndex - b.originalIndex);

  const lotLabels = buildLotLabels(orderedLots.map(({ ticket }) => ticket.name));
  const visibleLots: VisibleTicketLot[] = [];
  let cumulativeQuantity = 0;
  let cumulativeSold = 0;
  let offeredByOpenLots = 0;
  let previousLotsClosed = false;
  let hasCurrentLot = false;

  // lotNumber = posição cronológica (startsAt), nunca a posição no array da API,
  // que pode vir ordenado por preço (empate de preço => ordem aleatória).
  // A etiqueta exibida ao público é lotLabel (ver buildLotLabels).
  for (const [position, { ticket }] of orderedLots.entries()) {
    cumulativeQuantity += ticket.quantity;
    cumulativeSold += ticket.sold;

    const available = Math.max(0, cumulativeQuantity - cumulativeSold - offeredByOpenLots);
    const hasStarted = now >= new Date(ticket.startsAt);
    const hasEnded = now > new Date(ticket.endsAt);
    const reachedSalesLimit = typeof ticket.salesEndQuantity === "number" && ticket.sold >= ticket.salesEndQuantity;
    const soldOut = available <= 0 || reachedSalesLimit;
    const closed = hasEnded || soldOut;
    const alreadyOpened = wasLotOpened(ticket);
    // Com um lote anterior à venda, só continua aberto quem já tinha aberto;
    // lote que nunca abriu espera a vez na fila.
    const opens = hasCurrentLot ? alreadyOpened : hasStarted || previousLotsClosed;
    const lot = { ticket, lotNumber: position + 1, lotLabel: lotLabels[position] };

    if (opens && !closed) {
      visibleLots.push({ ...lot, status: "current", available });
      offeredByOpenLots += available;
      hasCurrentLot = true;
    } else if (hasCurrentLot ? alreadyOpened : hasStarted || closed) {
      visibleLots.push({ ...lot, status: "past", available: 0 });
    }

    previousLotsClosed = closed;
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
