-- Ticket ownership and transfers
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'TICKET_TRANSFER_RECEIVED';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'TICKET_TRANSFER_ACCEPTED';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'TICKET_TRANSFER_DECLINED';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'TICKET_TRANSFER_EXPIRED';

CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

ALTER TABLE "Ticket" ADD COLUMN "ownerId" TEXT;

CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT,
    "receiverEmail" TEXT,
    "receiverCpf" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransferHistory" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");
CREATE INDEX "Transfer_ticketId_status_idx" ON "Transfer"("ticketId", "status");
CREATE INDEX "Transfer_senderId_createdAt_idx" ON "Transfer"("senderId", "createdAt");
CREATE INDEX "Transfer_receiverId_status_idx" ON "Transfer"("receiverId", "status");
CREATE INDEX "Transfer_receiverEmail_status_idx" ON "Transfer"("receiverEmail", "status");
CREATE INDEX "Transfer_receiverCpf_status_idx" ON "Transfer"("receiverCpf", "status");
CREATE UNIQUE INDEX "Transfer_ticketId_pending_key" ON "Transfer"("ticketId") WHERE "status" = 'PENDING';
CREATE INDEX "TransferHistory_transferId_timestamp_idx" ON "TransferHistory"("transferId", "timestamp");
CREATE INDEX "TransferHistory_userId_timestamp_idx" ON "TransferHistory"("userId", "timestamp");

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
