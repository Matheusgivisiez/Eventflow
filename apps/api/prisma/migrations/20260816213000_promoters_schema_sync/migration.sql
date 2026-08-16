-- CreateEnum
CREATE TYPE "PromoterStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PromoterWithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PROMOTER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "promoterCommissionCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "promoterLinkId" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "city" TEXT,
ADD COLUMN "instagram" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "website" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "cpf" TEXT;

-- CreateTable
CREATE TABLE "Promoter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "document" TEXT,
    "city" TEXT,
    "state" TEXT,
    "instagram" TEXT,
    "pixKey" TEXT,
    "status" "PromoterStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoterLink" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "commissionValue" INTEGER NOT NULL DEFAULT 1000,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "commissionAcumCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoterLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoterWithdrawal" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PromoterWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PromoterWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_userId_key" ON "Promoter"("userId");

-- CreateIndex
CREATE INDEX "Promoter_tenantId_status_idx" ON "Promoter"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PromoterLink_code_key" ON "PromoterLink"("code");

-- CreateIndex
CREATE INDEX "PromoterLink_eventId_promoterId_idx" ON "PromoterLink"("eventId", "promoterId");

-- CreateIndex
CREATE INDEX "PromoterLink_code_idx" ON "PromoterLink"("code");

-- CreateIndex
CREATE INDEX "PromoterWithdrawal_promoterId_status_idx" ON "PromoterWithdrawal"("promoterId", "status");

-- CreateIndex
CREATE INDEX "CheckInLog_createdAt_idx" ON "CheckInLog"("createdAt");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Ticket_attendeeName_idx" ON "Ticket"("attendeeName");

-- CreateIndex
CREATE INDEX "Ticket_attendeeEmail_idx" ON "Ticket"("attendeeEmail");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoterLinkId_fkey" FOREIGN KEY ("promoterLinkId") REFERENCES "PromoterLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promoter" ADD CONSTRAINT "Promoter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promoter" ADD CONSTRAINT "Promoter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterLink" ADD CONSTRAINT "PromoterLink_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterLink" ADD CONSTRAINT "PromoterLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterWithdrawal" ADD CONSTRAINT "PromoterWithdrawal_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
