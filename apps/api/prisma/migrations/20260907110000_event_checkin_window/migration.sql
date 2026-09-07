ALTER TABLE "Event" ADD COLUMN "checkInOpensAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "checkInClosesAt" TIMESTAMP(3);

-- Eventos existentes passam a abrir a portaria no horário de início, sem
-- fechamento automático. Isso elimina a baixa antecipada sem interromper
-- eventos que se estendam além do horário inicialmente previsto.
UPDATE "Event"
SET "checkInOpensAt" = "startsAt"
WHERE "checkInOpensAt" IS NULL;
