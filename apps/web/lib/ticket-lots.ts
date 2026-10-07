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

export function getVisibleTicketLots(ticketTypes: TicketType[], now = new Date()): VisibleTicketLot[] {
  const orderedLots = ticketTypes
    .filter((ticket) => ticket.isActive)
    .map((ticket, index) => ({ ticket, originalIndex: index }))
    .sort((a, b) => new Date(a.ticket.startsAt).getTime() - new Date(b.ticket.startsAt).getTime() || a.originalIndex - b.originalIndex);

  const lotLabels = buildLotLabels(orderedLots.map(({ ticket }) => ticket.name));
  const visibleLots: VisibleTicketLot[] = [];
  let cumulativeQuantity = 0;
  let cumulativeSold = 0;
  // O 1º lote só abre no horário programado (startsAt). Os seguintes abrem no próprio
  // horário ou antes, assim que o lote anterior esgota ou encerra (virada de lote).
  let previousLotsClosed = false;

  // lotNumber = posição cronológica (startsAt), nunca a posição no array da API,
  // que pode vir ordenado por preço (empate de preço => ordem aleatória).
  // A etiqueta exibida ao público é lotLabel (ver buildLotLabels).
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
      visibleLots.push({ ticket, status: "current", available, lotNumber: position + 1, lotLabel: lotLabels[position] });
      break;
    }

    if (hasStarted || hasEnded || soldOut) {
      visibleLots.push({ ticket, status: "past", available: 0, lotNumber: position + 1, lotLabel: lotLabels[position] });
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
