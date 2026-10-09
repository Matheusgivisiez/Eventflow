/** Limites espelhados da API (issue-courtesy.dto.ts). */
export const MAX_GUESTS_PER_REQUEST = 30;
export const MAX_TICKETS_PER_GUEST = 10;

export type GuestDraft = { name: string; email: string; quantity: number; userId?: string };

export type ParsedGuestList = { guests: GuestDraft[]; errors: string[] };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Converte uma lista colada (uma pessoa por linha) em convidados.
 *
 * Aceita "Nome, email", "Nome; email; 2", colunas separadas por tabulação
 * (planilha) e a ordem invertida "email, Nome". A quantidade é opcional.
 * Linhas vazias são ignoradas; linhas sem e-mail válido viram erro com o
 * número da linha, para a pessoa corrigir antes de emitir.
 */
export function parseGuestList(text: string): ParsedGuestList {
  const guests: GuestDraft[] = [];
  const errors: string[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(/[;,\t]/).map((part) => part.trim()).filter(Boolean);
    const email = parts.find((part) => EMAIL.test(part));
    if (!email) {
      errors.push(`Linha ${index + 1}: e-mail não encontrado ou inválido.`);
      return;
    }
    const rest = parts.filter((part) => part !== email);
    const quantityPart = rest.find((part) => /^\d+$/.test(part));
    const name = rest.filter((part) => part !== quantityPart).join(" ").replace(/\s+/g, " ").trim();
    if (name.length < 2) {
      errors.push(`Linha ${index + 1}: informe o nome do convidado.`);
      return;
    }
    const quantity = quantityPart ? Number(quantityPart) : 1;
    if (quantity < 1 || quantity > MAX_TICKETS_PER_GUEST) {
      errors.push(`Linha ${index + 1}: a quantidade deve ficar entre 1 e ${MAX_TICKETS_PER_GUEST}.`);
      return;
    }
    guests.push({ name, email: email.toLowerCase(), quantity });
  });

  if (guests.length > MAX_GUESTS_PER_REQUEST) {
    errors.push(`Envie no máximo ${MAX_GUESTS_PER_REQUEST} convidados por vez. Divida a lista em partes.`);
  }
  return { guests, errors };
}

/** Valida os convidados digitados no formulário. Devolve a primeira pendência, se houver. */
export function validateGuests(guests: GuestDraft[]): string | null {
  const filled = guests.filter((guest) => guest.name.trim() || guest.email.trim());
  if (filled.length === 0) return "Adicione pelo menos um convidado.";
  if (filled.length > MAX_GUESTS_PER_REQUEST) return `Envie no máximo ${MAX_GUESTS_PER_REQUEST} convidados por vez.`;
  for (const [index, guest] of filled.entries()) {
    if (guest.name.trim().length < 2) return `Convidado ${index + 1}: informe o nome.`;
    if (!EMAIL.test(guest.email.trim())) return `Convidado ${index + 1}: e-mail inválido.`;
    if (!Number.isInteger(guest.quantity) || guest.quantity < 1 || guest.quantity > MAX_TICKETS_PER_GUEST) {
      return `Convidado ${index + 1}: a quantidade deve ficar entre 1 e ${MAX_TICKETS_PER_GUEST}.`;
    }
  }
  return null;
}
