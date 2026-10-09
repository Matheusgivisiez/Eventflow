/**
 * Retorno ao checkout depois de entrar, criar conta ou confirmar o e-mail.
 *
 * Só caminhos `/checkout/<slug>` com uma query simples são aceitos — a mesma
 * regra da API (email-verification.service.ts). Qualquer outra coisa é
 * descartada, para o parâmetro `next` nunca levar a um endereço externo.
 */
const CHECKOUT_RETURN_PATH = /^\/checkout\/[A-Za-z0-9_-]+(\?[A-Za-z0-9_\-.~%&=:,+]*)?$/;
const CHECKOUT_RETURN_MAX_LENGTH = 500;

export function safeCheckoutReturnPath(value?: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const path = value.trim();
  if (!path || path.length > CHECKOUT_RETURN_MAX_LENGTH) return undefined;
  return CHECKOUT_RETURN_PATH.test(path) ? path : undefined;
}

/** Acrescenta `?next=` (ou `&next=`) a uma rota interna quando há checkout para retomar. */
export function withCheckoutReturn(href: string, next?: string | null): string {
  const safe = safeCheckoutReturnPath(next);
  if (!safe) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}next=${encodeURIComponent(safe)}`;
}

/** Lê o `next` da URL atual do navegador, já validado. */
export function readCheckoutReturnFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return safeCheckoutReturnPath(new URLSearchParams(window.location.search).get("next"));
}
