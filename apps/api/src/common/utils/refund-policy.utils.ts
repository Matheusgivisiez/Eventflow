/**
 * Política de reembolso solicitado pelo comprador, definida por evento.
 * Usada no backend (validação) e espelhada na resposta da área do comprador.
 */

type RefundPolicyEvent = {
  allowTicketRefund: boolean;
  ticketRefundLockHours?: number | null;
  startsAt: Date | string;
};

/** Último instante em que o comprador ainda pode pedir reembolso. */
export function getRefundDeadline(event: RefundPolicyEvent): Date {
  const startsAt = new Date(event.startsAt).getTime();
  const hours = Math.max(0, event.ticketRefundLockHours ?? 0);
  return new Date(startsAt - hours * 60 * 60 * 1000);
}

/** Motivo do bloqueio, ou `null` quando o reembolso está disponível. */
export function getRefundBlockReason(event: RefundPolicyEvent, now = new Date()): string | null {
  if (!event.allowTicketRefund) {
    return "Este evento não aceita reembolso pelo site. Fale com o organizador.";
  }
  if (now >= getRefundDeadline(event)) {
    return "O prazo para solicitar reembolso deste evento já terminou.";
  }
  return null;
}
