# Verificação de e-mail da conta (Bloco A do plano de compra como convidado)

## Por que existe

Antes desta mudança, o Eventflow tratava "ter o mesmo e-mail" como prova de propriedade.
Qualquer pessoa podia criar uma conta usando o e-mail de outra e alcançar:

- `profile.service.myTickets` — ingressos de pedidos de convidado com aquele `buyerEmail`
- `buyer.service.listTickets` / `reconcileOwnedOrders` — os mesmos ingressos e a reconciliação dos pedidos órfãos
- `transfers.service.findOwnedTicket` — **transferir** o ingresso de outra pessoa
- `transfers.service.userCpfValues` — o **CPF** informado no pedido de convidado

Isso é exposição de dado pessoal (LGPD), não apenas um risco de produto. O envio de
e-mail de confirmação de compra aumentaria o volume de pedidos órfãos nessa condição,
por isso a verificação foi feita antes do envio de e-mail, e não depois.

## O que mudou

- `User.emailVerifiedAt` (nullable) e a tabela `EmailVerificationToken`
  (hash SHA-256 do token, expiração de 30 min, uso único, um link ativo por vez).
- `RequestUser.emailVerified` é preenchido pela `JwtStrategy` a partir de `emailVerifiedAt`.
- `resolveClaimEmail(user)` (`common/utils/claim-email.utils.ts`) é o único ponto que
  autoriza casar dados por e-mail. Retorna `null` para conta não verificada.
- Os quatro pontos acima passaram a usar `resolveClaimEmail`. Com `null`, as cláusulas
  por `buyerEmail` / `attendeeEmail` simplesmente **não entram** na query.
- `POST /auth/verify-email` e `POST /auth/resend-verification` (resposta neutra,
  cooldown de 60s, throttle de 3/min). Página web em `/verificar-email`.
- O link de verificação é enviado no cadastro. Falha de SMTP é registrada em log e
  **não** quebra o cadastro.

## Compatibilidade com contas existentes

A migração `20260913120000_email_verification` faz o backfill:

```sql
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
```

Toda conta criada antes do deploy continua verificada. Ninguém perde acesso aos
próprios ingressos. Somente contas criadas a partir do deploy precisam confirmar.

## Pré-requisito de deploy: SMTP

`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` estão vazios hoje. Sem eles o
`MailService` retorna `SKIPPED` e **nenhum link de verificação é enviado** — contas
novas ficariam sem caminho para confirmar o e-mail. Configure o SMTP no Render antes
de subir esta mudança, junto com SPF, DKIM e DMARC do domínio remetente.

## Ordem do deploy

1. Configurar SMTP e a autenticação de domínio.
2. `pnpm --filter @eventflow/api prisma:generate`
3. Rodar a migração (o backfill precisa acontecer junto com o schema).
4. Subir API e web na mesma janela — `/verificar-email` é o destino do link.

## Ainda em aberto

- Rate limit em `GET /checkout/order/:orderId`.
- `orderAccessToken` deixar de ser nullable.
- Vinculação retroativa física dos pedidos antigos (hoje a leitura já é
  compatível por `userId` **ou** e-mail verificado, que resolve o caso de uso).
