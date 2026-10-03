-- O acesso passou a ser por evento (EventAccess). Sem este backfill, a equipe
-- que já existia perderia check-in e edição em todos os eventos no deploy.
-- Regra: CHECK_IN + EDIT_EVENT -> GESTOR; só EDIT_EVENT -> EDITOR; só CHECK_IN -> OPERACAO.
-- Vale para os eventos existentes da organização; eventos novos exigem atribuição pelo criador.
INSERT INTO "EventAccess" ("id", "eventId", "userId", "role", "createdAt", "updatedAt")
SELECT
  'ea_' || replace(gen_random_uuid()::text, '-', ''),
  e."id",
  tm."userId",
  (CASE
    WHEN 'CHECK_IN' = ANY (tm."permissions"::text[]) AND 'EDIT_EVENT' = ANY (tm."permissions"::text[]) THEN 'GESTOR'
    WHEN 'EDIT_EVENT' = ANY (tm."permissions"::text[]) THEN 'EDITOR'
    ELSE 'OPERACAO'
  END)::"EventAccessRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "TeamMember" tm
JOIN "User" u ON u."id" = tm."userId" AND u."role" = 'TEAM' AND u."tenantId" = tm."tenantId"
JOIN "Event" e ON e."tenantId" = tm."tenantId" AND e."ownerId" <> tm."userId"
WHERE 'CHECK_IN' = ANY (tm."permissions"::text[]) OR 'EDIT_EVENT' = ANY (tm."permissions"::text[])
ON CONFLICT ("eventId", "userId") DO NOTHING;
