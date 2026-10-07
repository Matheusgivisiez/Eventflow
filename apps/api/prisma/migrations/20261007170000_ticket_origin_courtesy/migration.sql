-- Origem do ingresso: venda, cortesia do organizador ou convidado da Eventflow.
--
-- Só adiciona um tipo e colunas com DEFAULT constante: no Postgres isso não
-- reescreve a tabela, então é seguro aplicar com vendas abertas. Todo registro
-- existente vira SALE, que é exatamente o que ele já era. O código antigo
-- continua funcionando contra este schema (ele não conhece as colunas e o
-- banco preenche SALE sozinho), então deploy e rollback são seguros.
CREATE TYPE "TicketOrigin" AS ENUM ('SALE', 'ORGANIZER_COURTESY', 'PLATFORM_COURTESY');

ALTER TABLE "TicketType" ADD COLUMN "origin" "TicketOrigin" NOT NULL DEFAULT 'SALE';

ALTER TABLE "Order"
  ADD COLUMN "origin" "TicketOrigin" NOT NULL DEFAULT 'SALE',
  ADD COLUMN "issuedById" TEXT;

ALTER TABLE "Ticket" ADD COLUMN "origin" "TicketOrigin" NOT NULL DEFAULT 'SALE';

CREATE INDEX "Ticket_eventId_origin_idx" ON "Ticket"("eventId", "origin");
