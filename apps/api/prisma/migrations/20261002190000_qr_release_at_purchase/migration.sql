-- "Liberar QR Code: No momento da compra" gravava 0 minutos, que na prática
-- significa "liberar no horário de início do evento" - o ingresso chegava
-- bloqueado. A partir de agora, os dois campos vazios (NULL) representam
-- "liberado já na compra". Corrige os eventos criados com aquela opção.
UPDATE "Event"
SET "qrCodeReleaseMinutesBeforeStart" = NULL
WHERE "qrCodeReleaseMinutesBeforeStart" = 0
  AND "qrCodeReleaseAt" IS NULL;
