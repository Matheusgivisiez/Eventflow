ALTER TABLE "Order" ADD COLUMN "stockReservedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "orderAccessToken" TEXT;
CREATE UNIQUE INDEX "Order_orderAccessToken_key" ON "Order"("orderAccessToken");
