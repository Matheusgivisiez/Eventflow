-- DropIndex
DROP INDEX "NotificationLog_type_sentAt_idx";

-- DropIndex
DROP INDEX "Order_buyerEmail_status_idx";

-- DropIndex
DROP INDEX "Order_eventId_status_createdAt_idx";

-- DropIndex
DROP INDEX "Payment_orderId_provider_idx";

-- DropIndex
DROP INDEX "Payment_provider_providerRef_idx";

-- DropIndex
DROP INDEX "Ticket_attendeeEmail_status_idx";

-- DropIndex
DROP INDEX "Ticket_eventId_createdAt_idx";

-- CreateIndex
CREATE INDEX "CheckInLog_ticketId_createdAt_idx" ON "CheckInLog"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_slug_status_idx" ON "Event"("slug", "status");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_buyerDocument_eventId_status_idx" ON "Order"("buyerDocument", "eventId", "status");

-- CreateIndex
CREATE INDEX "Payment_eventId_status_idx" ON "Payment"("eventId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_eventId_uuid_idx" ON "Ticket"("eventId", "uuid");

-- CreateIndex
CREATE INDEX "Ticket_uuid_status_idx" ON "Ticket"("uuid", "status");

-- CreateIndex
CREATE INDEX "TicketType_eventId_startsAt_endsAt_idx" ON "TicketType"("eventId", "startsAt", "endsAt");
