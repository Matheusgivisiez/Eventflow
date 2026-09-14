export type TicketTransferTemplateInput = {
  recipientName: string;
  eventTitle: string;
  counterpartName: string;
  actionUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(input: TicketTransferTemplateInput, copy: {
  subject: string;
  headline: string;
  detail: string;
  button: string;
}) {
  const subject = copy.subject.replace("{event}", input.eventTitle);
  const detail = copy.detail
    .replace("{event}", input.eventTitle)
    .replace("{counterpart}", input.counterpartName);
  const text = [
    `Olá, ${input.recipientName}.`,
    "",
    copy.headline,
    detail,
    "",
    `${copy.button}: ${input.actionUrl}`,
    "",
    "Event Flow"
  ].join("\n");

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1729">
  <p style="font-size:16px">Olá, ${escapeHtml(input.recipientName)}.</p>
  <h1 style="font-size:22px;line-height:1.3;margin:20px 0 8px">${escapeHtml(copy.headline)}</h1>
  <p style="font-size:16px;line-height:1.6">${escapeHtml(detail)}</p>
  <p style="margin:24px 0">
    <a href="${escapeHtml(input.actionUrl)}" style="background:#743CFF;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:bold;display:inline-block">${escapeHtml(copy.button)}</a>
  </p>
  <p style="font-size:12px;color:#9b93ad;margin-top:32px">Event Flow</p>
</div>`.trim();

  return { subject, text, html };
}

export function renderTransferReceived(input: TicketTransferTemplateInput) {
  return render(input, {
    subject: "Você recebeu um ingresso — {event}",
    headline: "Um ingresso está esperando sua confirmação",
    detail: "{counterpart} enviou um ingresso para {event}. Aceite ou recuse a transferência na sua conta.",
    button: "Responder transferência"
  });
}

export function renderTransferAccepted(input: TicketTransferTemplateInput) {
  return render(input, {
    subject: "Transferência aceita — {event}",
    headline: "Seu ingresso foi transferido",
    detail: "{counterpart} aceitou o ingresso de {event}. A transferência foi concluída.",
    button: "Ver meus ingressos"
  });
}

export function renderTransferDeclined(input: TicketTransferTemplateInput) {
  return render(input, {
    subject: "Transferência recusada — {event}",
    headline: "A transferência foi recusada",
    detail: "{counterpart} recusou o ingresso de {event}. Ele continua disponível na sua conta.",
    button: "Ver meus ingressos"
  });
}

export function renderTransferExpired(input: TicketTransferTemplateInput) {
  return render(input, {
    subject: "Transferência expirada — {event}",
    headline: "O prazo da transferência terminou",
    detail: "A transferência do ingresso de {event} para {counterpart} expirou. Ele continua disponível na sua conta.",
    button: "Ver meus ingressos"
  });
}
