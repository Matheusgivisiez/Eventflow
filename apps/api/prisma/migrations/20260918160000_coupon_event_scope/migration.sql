-- Restricao de cupom por evento.
--
-- Ate aqui um cupom valia para TODOS os eventos do organizador (ou, sendo um
-- cupom global do admin, para qualquer evento). Nao havia como restringir um
-- cupom a um ou mais eventos especificos na criacao.
--
-- "CouponEvent" e a lista de eventos aos quais um cupom fica restrito. Cupons
-- SEM nenhuma linha aqui continuam valendo para todos os eventos do tenant,
-- exatamente como hoje - esta migration nao muda o comportamento de nenhum
-- cupom existente.

CREATE TABLE "CouponEvent" (
    "couponId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponEvent_pkey" PRIMARY KEY ("couponId", "eventId")
);

CREATE INDEX "CouponEvent_eventId_idx" ON "CouponEvent"("eventId");

ALTER TABLE "CouponEvent"
  ADD CONSTRAINT "CouponEvent_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponEvent"
  ADD CONSTRAINT "CouponEvent_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
