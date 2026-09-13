-- Fila persistente e idempotente de notificacoes.
-- Sem a chave de deduplicacao, um webhook reprocessado ou uma reconciliacao
-- concorrente enviaria o mesmo e-mail de confirmacao mais de uma vez.

CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

ALTER TABLE "NotificationLog" ADD COLUMN "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "NotificationLog" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "NotificationLog" ADD COLUMN "lastError" TEXT;
ALTER TABLE "NotificationLog" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "NotificationLog" ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- As linhas anteriores a esta migracao eram apenas registro: nenhum e-mail
-- chegou a ser enviado e nada deve reprocessa-las.
UPDATE "NotificationLog" SET "status" = 'SKIPPED' WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");
CREATE INDEX "NotificationLog_status_sentAt_idx" ON "NotificationLog"("status", "sentAt");
