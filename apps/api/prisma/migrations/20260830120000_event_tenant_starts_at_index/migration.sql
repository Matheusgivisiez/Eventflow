-- Speeds up the organizer event list, especially the unfiltered "Todos" tab.
CREATE INDEX "Event_tenantId_startsAt_idx" ON "Event"("tenantId", "startsAt");
