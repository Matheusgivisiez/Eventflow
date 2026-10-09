-- VIPs emitidos para contas que já existiam antes da emissão pertencem a essas contas.
-- A restrição de origem impede que compras e transferências mudem de dono.
UPDATE "Ticket" AS ticket
SET "ownerId" = recipient."id"
FROM "User" AS recipient
WHERE ticket."origin" = 'PLATFORM_COURTESY'
  AND ticket."ownerId" IS NULL
  AND lower(trim(ticket."attendeeEmail")) = lower(trim(recipient."email"))
  AND recipient."createdAt" <= ticket."createdAt";
