/**
 * Mascaras para confirmacao de identidade.
 *
 * Quando alguem precisa apenas CONFERIR que achou a pessoa certa (transferir um
 * ingresso, por exemplo), a resposta nao pode entregar o dado pessoal completo
 * de terceiros: isso transforma o endpoint em consulta de CPF -> nome + e-mail.
 * O suficiente para reconhecer, nunca o suficiente para colecionar.
 */

/** "riquelmy@gmail.com" -> "ri****@gmail.com" */
export function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return "****";

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, local.length <= 2 ? 1 : 2);
  const maskedDomain = maskDomain(domain);

  return `${visible}${"*".repeat(4)}@${maskedDomain}`;
}

/** "Riquelmy Silva Vasconcelos" -> "Riquelmy S. V." */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";

  const [first, ...rest] = parts;
  const initials = rest.map((part) => `${part.charAt(0).toUpperCase()}.`);

  return [first, ...initials].join(" ");
}

/**
 * Provedores conhecidos ficam visiveis (ajudam a pessoa a reconhecer a conta);
 * um dominio proprio e mascarado porque costuma identificar empregador.
 */
const PUBLIC_MAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br"
]);

function maskDomain(domain: string): string {
  if (PUBLIC_MAIL_DOMAINS.has(domain)) return domain;

  const firstDot = domain.indexOf(".");
  if (firstDot <= 0) return "****";

  return `${domain.charAt(0)}***${domain.slice(firstDot)}`;
}
