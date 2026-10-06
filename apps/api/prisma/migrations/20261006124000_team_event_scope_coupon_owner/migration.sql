ALTER TABLE "TeamMember"
  ADD COLUMN "managerId" TEXT,
  ADD COLUMN "allEvents" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "eventIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "scopeConfigured" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "TeamMember_managerId_idx" ON "TeamMember"("managerId");
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vincula membros antigos ao criador quando seus acessos existentes apontam
-- de forma inequívoca para eventos de uma única pessoa.
UPDATE "TeamMember" tm SET "managerId" = (
  SELECT MIN(e."ownerId") FROM "EventAccess" ea
  JOIN "Event" e ON e.id = ea."eventId"
  WHERE ea."userId" = tm."userId" AND e."tenantId" = tm."tenantId"
  HAVING COUNT(DISTINCT e."ownerId") = 1
)
WHERE EXISTS (
  SELECT 1 FROM "EventAccess" ea JOIN "Event" e ON e.id = ea."eventId"
  WHERE ea."userId" = tm."userId" AND e."tenantId" = tm."tenantId"
);

-- Sem acessos anteriores, associa ao único organizador da organização.
UPDATE "TeamMember" tm SET "managerId" = (
  SELECT MIN(u.id) FROM "User" u
  WHERE u."tenantId" = tm."tenantId" AND u.role = 'ORGANIZER'
  HAVING COUNT(*) = 1
)
WHERE tm."managerId" IS NULL;

ALTER TABLE "Coupon" ADD COLUMN "ownerId" TEXT;
CREATE INDEX "Coupon_ownerId_idx" ON "Coupon"("ownerId");
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
