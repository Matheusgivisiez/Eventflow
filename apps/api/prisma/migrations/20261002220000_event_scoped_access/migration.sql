CREATE TYPE "EventAccessRole" AS ENUM ('GESTOR', 'EDITOR', 'OPERACAO');

CREATE TABLE "EventAccess" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EventAccessRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventAccess_eventId_userId_key" ON "EventAccess"("eventId", "userId");
CREATE INDEX "EventAccess_userId_role_idx" ON "EventAccess"("userId", "role");

ALTER TABLE "EventAccess"
ADD CONSTRAINT "EventAccess_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventAccess"
ADD CONSTRAINT "EventAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
