-- AbacatePay checkout tracking and webhook idempotency
ALTER TABLE "OrderItem" ADD COLUMN "seatIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Payment" ADD COLUMN "checkoutId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "billId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "transactionId" TEXT;

CREATE TABLE "PaymentLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT,
    "event" TEXT NOT NULL,
    "status" "PaymentStatus",
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentLog_provider_providerEventId_key" ON "PaymentLog"("provider", "providerEventId");
CREATE INDEX "Payment_provider_checkoutId_idx" ON "Payment"("provider", "checkoutId");
CREATE INDEX "Payment_provider_transactionId_idx" ON "Payment"("provider", "transactionId");
CREATE INDEX "PaymentLog_orderId_createdAt_idx" ON "PaymentLog"("orderId", "createdAt");
CREATE INDEX "PaymentLog_paymentId_createdAt_idx" ON "PaymentLog"("paymentId", "createdAt");
CREATE INDEX "PaymentLog_provider_event_idx" ON "PaymentLog"("provider", "event");
CREATE INDEX "PaymentLog_processedAt_idx" ON "PaymentLog"("processedAt");

ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
