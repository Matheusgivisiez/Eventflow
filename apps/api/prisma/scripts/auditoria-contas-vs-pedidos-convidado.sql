-- Auditoria a executar ANTES de aplicar a migração 20260913120000_email_verification.
--
-- Aquela migração marca toda conta existente como verificada
-- (emailVerifiedAt = createdAt) para não derrubar a base atual no deploy.
-- O efeito colateral e legitimar, sem prova, qualquer conta que tenha sido
-- criada no passado com o e-mail de outra pessoa.
--
-- Esta consulta lista as contas que passariam a alcançar pedidos de convidado
-- que elas nunca fizeram. Não há como decidir isso automaticamente: revise
-- caso a caso e, para qualquer conta suspeita, rode o UPDATE do fim do arquivo
-- para exigir confirmação dela.

SELECT
  u."id"           AS user_id,
  u."email",
  u."name",
  u."createdAt"    AS conta_criada_em,
  COUNT(o."id")    AS pedidos_convidado_alcancados,
  MIN(o."createdAt") AS pedido_mais_antigo,
  MAX(o."createdAt") AS pedido_mais_recente,
  -- Sinal mais forte de que a conta não é do comprador: o pedido é anterior
  -- a conta e nunca esteve ligado a nenhum usuário.
  SUM(CASE WHEN o."createdAt" < u."createdAt" THEN 1 ELSE 0 END) AS pedidos_anteriores_a_conta
FROM "User" u
JOIN "Order" o
  ON LOWER(o."buyerEmail") = LOWER(u."email")
 AND o."userId" IS NULL
GROUP BY u."id", u."email", u."name", u."createdAt"
ORDER BY pedidos_anteriores_a_conta DESC, pedidos_convidado_alcancados DESC;

-- Para exigir confirmação de contas específicas depois do deploy:
--
--   UPDATE "User" SET "emailVerifiedAt" = NULL WHERE "id" IN ('...', '...');
--
-- A pessoa recebe o pedido de confirmação ao tentar usar Meus Ingressos e
-- recupera o acesso pelo próprio e-mail, sem perder nada.
