-- Lease de entrega.
--
-- A reivindicacao anterior usava apenas o compare-and-swap em "attempts", que
-- so protege processos que leram o MESMO valor. Um segundo processo chegando
-- logo depois lia o valor ja incrementado, continuava vendo "sentAt" antigo,
-- concluia que a linha estava abandonada e enviava o e-mail de novo.
--
-- "claimedAt" marca o instante em que alguem assumiu a entrega, e o abandono
-- passa a ser medido a partir dele.

ALTER TABLE "NotificationLog" ADD COLUMN "claimedAt" TIMESTAMP(3);

-- Linhas ja entregues ou encerradas nao devem ser reivindicadas por ninguem.
UPDATE "NotificationLog"
   SET "claimedAt" = COALESCE("deliveredAt", "sentAt")
 WHERE "status" <> 'PENDING';
