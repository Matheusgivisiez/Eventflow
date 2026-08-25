-- AddUniqueConstraint: PromoterLink (promoterId, eventId)
-- Prevents a promoter from being linked to the same event more than once.

-- First remove any duplicate rows, keeping only the most recent link per (promoterId, eventId)
DELETE FROM "PromoterLink"
WHERE id NOT IN (
  SELECT DISTINCT ON ("promoterId", "eventId") id
  FROM "PromoterLink"
  ORDER BY "promoterId", "eventId", "createdAt" DESC
);

-- Add the unique constraint
CREATE UNIQUE INDEX "PromoterLink_promoterId_eventId_key" ON "PromoterLink"("promoterId", "eventId");
