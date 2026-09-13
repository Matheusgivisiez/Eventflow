-- Auditoria a executar ANTES de aplicar a migracao 20260913120000_email_verification.
--
-- Aquela migracao marca toda conta existente como verificada
-- (emailVerifiedAt = createdAt) para nao derrubar a base atual no deploy.
-- O efeito colateral e legitimar, sem prova, qualquer conta que tenha sido
-- criada no passado com o e-mail de outra pessoa.
--
-- Esta consulta lista as contas que passariam a alcancar pedidos de convidado
-- que elas nunca fizeram. Nao ha como decidir isso automaticamente: revise
-- caso a caso e, para qualquer conta suspeita, rode o UPDATE do fim do arquivo
-- para exigir confirmacao dela.

SELECT
  u."id"           AS user_id,
  u."email",
  u."name",
  u."createdAt"    AS conta_criada_em,
  COUNT(o."id")    AS pedidos_convidado_alcancados,
  MIN(o."createdAt") AS pedido_mais_antigo,
  MAX(o."createdAt") AS pedido_mais_recente,
  -- Sinal mais forte de que a conta nao e do comprador: o pedido e anterior
  -- a conta e nunca esteve ligado a nenhum usuario.
  SUM(CASE WHEN o."createdAt" < u."createdAt" THEN 1 ELSE 0 END) AS pedidos_anteriores_a_conta
FROM "User" u
JOIN "Order" o
  ON LOWER(o."buyerEmail") = LOWER(u."email")
 AND o."userId" IS NULL
GROUP BY u."id", u."email", u."name", u."createdAt"
ORDER BY pedidos_anteriores_a_conta DESC, pedidos_convidado_alcancados DESC;

-- Para exigir confirmacao de contas especificas depois do deploy:
--
--   UPDATE "User" SET "emailVerifiedAt" = NULL WHERE "id" IN ('...', '...');
--
-- A pessoa recebe o pedido de confirmacao ao tentar usar Meus Ingressos e
-- recupera o acesso pelo proprio e-mail, sem perder nada.
