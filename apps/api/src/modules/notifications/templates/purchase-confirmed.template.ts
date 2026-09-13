export type PurchaseConfirmedTemplateInput = {
  buyerName: string;
  eventTitle: string;
  eventStartsAt: Date;
  orderId: string;
  ticketCount: number;
  /** Secure, order-scoped link. Never a session and never the full ticket data. */
  orderUrl: string;
  createAccountUrl: string;
};

const BRAND = "Event Flow";

export function orderCode(orderId: string) {
  return orderId.slice(-8).toUpperCase();
}

export function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Purchase confirmation e-mail.
 *
 * Deliberately carries no CPF, no phone, no ticket signature and no QR payload:
 * the message travels through servers we do not control, so it only points at
 * the order page, which applies the event's QR release rules on its own.
 */
export function renderPurchaseConfirmed(input: PurchaseConfirmedTemplateInput) {
  const code = orderCode(input.orderId);
  const when = formatEventDate(input.eventStartsAt);
  const ticketLine =
    input.ticketCount === 1 ? "1 ingresso" : `${input.ticketCount} ingressos`;

  const subject = `Pagamento aprovado — ${input.eventTitle}`;

  const text = [
    `Ola, ${input.buyerName}.`,
    "",
    `Seu pagamento foi aprovado e ${ticketLine} ja esta disponivel.`,
    "",
    `Evento: ${input.eventTitle}`,
    `Data: ${when}`,
    `Pedido: ${code}`,
    "",
    `Ver seus ingressos: ${input.orderUrl}`,
    "",
    "Este link e pessoal: quem tiver o endereco consegue ver este pedido. Nao compartilhe.",
    "",
    `Quer todos os seus ingressos em um lugar so? Crie uma conta: ${input.createAccountUrl}`,
    "",
    BRAND
  ].join("\n");

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1729">
  <p style="font-size:16px">Ola, ${escapeHtml(input.buyerName)}.</p>
  <p style="font-size:16px">Seu pagamento foi aprovado e ${escapeHtml(ticketLine)} já está disponível.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
    <tr><td style="padding:6px 0;color:#6b647a">Evento</td><td style="padding:6px 0;font-weight:bold">${escapeHtml(input.eventTitle)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b647a">Data</td><td style="padding:6px 0">${escapeHtml(when)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b647a">Pedido</td><td style="padding:6px 0">${escapeHtml(code)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b647a">Quantidade</td><td style="padding:6px 0">${escapeHtml(ticketLine)}</td></tr>
  </table>
  <p style="margin:24px 0">
    <a href="${escapeHtml(input.orderUrl)}" style="background:#743CFF;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:bold;display:inline-block">Ver meus ingressos</a>
  </p>
  <p style="font-size:13px;color:#6b647a">Este link é pessoal: quem tiver o endereço consegue ver este pedido. Não compartilhe.</p>
  <p style="font-size:14px;margin-top:24px">
    Quer todos os seus ingressos em um lugar só?
    <a href="${escapeHtml(input.createAccountUrl)}" style="color:#743CFF">Crie sua conta</a>.
  </p>
  <p style="font-size:12px;color:#9b93ad;margin-top:32px">${BRAND}</p>
</div>`.trim();

  return { subject, text, html };
}
