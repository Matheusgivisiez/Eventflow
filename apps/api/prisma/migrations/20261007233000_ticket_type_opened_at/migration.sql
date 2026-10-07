-- Marca de quando o lote ficou à venda pela primeira vez.
--
-- Um lote que já abriu não pode fechar de novo quando um ingresso volta ao lote
-- anterior (pedido vencido). A regra precisa saber que o lote abriu mesmo quando
-- ele ainda não tem venda, e isso não dá para deduzir de quantity/sold.
--
-- Coluna anulável sem DEFAULT: no Postgres não reescreve a tabela, então é seguro
-- aplicar com vendas abertas. O código antigo não conhece a coluna e segue
-- funcionando, então deploy e rollback são seguros.
ALTER TABLE "TicketType" ADD COLUMN "openedAt" TIMESTAMP(3);

-- Lote de venda com ingresso reservado ou vendido já esteve aberto.
UPDATE "TicketType" SET "openedAt" = CURRENT_TIMESTAMP WHERE "sold" > 0 AND "origin" = 'SALE';
