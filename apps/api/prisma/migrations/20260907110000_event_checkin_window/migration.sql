-- Sincroniza configuracoes de transferencia/QR que ja existiam no schema,
-- mas nao estavam representadas no historico de migrations.
ALTER TABLE "Event"
ADD COLUMN "allowTicketTransfer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "ticketTransferLockTime" TIMESTAMP(3),
ADD COLUMN "qrCodeReleaseMinutesBeforeStart" INTEGER DEFAULT 60,
ADD COLUMN "qrCodeReleaseAt" TIMESTAMP(3),
ADD COLUMN "checkInOpensAt" TIMESTAMP(3),
ADD COLUMN "checkInClosesAt" TIMESTAMP(3);

-- Eventos existentes passam a abrir a portaria no horário de início, sem
-- fechamento automático. Isso elimina a baixa antecipada sem interromper
-- eventos que se estendam além do horário inicialmente previsto.
UPDATE "Event"
SET "checkInOpensAt" = "startsAt"
WHERE "checkInOpensAt" IS NULL;
