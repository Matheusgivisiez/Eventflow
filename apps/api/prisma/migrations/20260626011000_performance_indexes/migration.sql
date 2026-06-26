CREATE INDEX IF NOT EXISTS "Order_eventId_status_createdAt_idx" ON "Order"("eventId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_buyerEmail_status_idx" ON "Order"("buyerEmail", "status");
CREATE INDEX IF NOT EXISTS "Ticket_attendeeEmail_status_idx" ON "Ticket"("attendeeEmail", "status");
CREATE INDEX IF NOT EXISTS "Ticket_eventId_createdAt_idx" ON "Ticket"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_provider_providerRef_idx" ON "Payment"("provider", "providerRef");
CREATE INDEX IF NOT EXISTS "Payment_orderId_provider_idx" ON "Payment"("orderId", "provider");
CREATE INDEX IF NOT EXISTS "CheckInLog_status_createdAt_idx" ON "CheckInLog"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationLog_type_sentAt_idx" ON "NotificationLog"("type", "sentAt");
