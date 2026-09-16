-- Política de reembolso por evento.
--
-- Antes, todo ingresso ativo podia pedir reembolso pelo site. Agora o
-- organizador decide evento a evento. Por decisão de produto, todos os
-- eventos existentes começam com o reembolso DESLIGADO (default false);
-- o organizador religa no painel do evento se quiser.
--
-- "ticketRefundLockHours": prazo em horas antes do início. NULL = até o início.

ALTER TABLE "Event" ADD COLUMN "allowTicketRefund" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "ticketRefundLockHours" INTEGER;
