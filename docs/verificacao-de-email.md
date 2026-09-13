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
- `EmailVerificationService` (módulo próprio) emite e invalida os links. Fica fora
  do `AuthService` porque a prova precisa ser destruída em três outros lugares.
- Os quatro pontos acima passaram a usar `resolveClaimEmail`. Com `null`, as cláusulas
  por `buyerEmail` / `attendeeEmail` simplesmente **não entram** na query.
- `POST /auth/verify-email` e `POST /auth/resend-verification` (resposta neutra,
  cooldown de 60s, throttle de 3/min). Página web em `/verificar-email`.
- O link de verificação é enviado no cadastro. Falha de SMTP é registrada em log e
  **não** quebra o cadastro.

## Troca de e-mail

Uma conta verificada que muda de endereço **deixa de ser verificada**. Sem isso o
buraco reabre inteiro: basta verificar o próprio e-mail, trocar para o e-mail da
vítima e a prova antiga continuaria valendo.

Toda rota que altera `User.email` — `PATCH /users/me`, `PATCH /users/:id` e
`PATCH /profile` — escreve `emailVerifiedAt: null` na mesma instrução que grava o
novo endereço, invalida os links pendentes e envia um novo. A comparação ignora
caixa e espaços, então salvar o mesmo endereço não derruba a verificação.

O envio acontece **fora** da transação: SMTP não segura lock, e uma falha de
e-mail não desfaz um perfil que o usuário já salvou.

`EmailVerificationService.issue()` não lança — nem no SMTP, nem na criação do
token. O endereço novo já foi gravado quando ele é chamado, então lançar
responderia 500 para uma alteração que de fato aconteceu, e o usuário acharia que
nada mudou. A perda do link é recuperável: a conta fica não verificada e a pessoa
pede outro em `POST /auth/resend-verification`. O método devolve `boolean` para
quem quiser registrar o resultado.

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

## Auditoria antes do deploy

O backfill legitima, sem prova, qualquer conta que tenha sido criada no passado
com o e-mail de outra pessoa. Rode
`prisma/scripts/auditoria-contas-vs-pedidos-convidado.sql` antes de aplicar a
migração: ele lista as contas que passariam a alcançar pedidos de convidado que
não são delas, destacando as que são **posteriores** ao pedido. Para qualquer
conta suspeita, basta `UPDATE "User" SET "emailVerifiedAt" = NULL` — a pessoa
recupera o acesso confirmando o próprio e-mail.

## Ainda em aberto

- `orderAccessToken` deixar de ser nullable.
- Vinculação retroativa física dos pedidos antigos (hoje a leitura já é
  compatível por `userId` **ou** e-mail verificado, que resolve o caso de uso).
- `UsersService.update` (`PATCH /users/:id`) continua aceitando `role` no corpo,
  o que permite a um organizador alterar o papel de usuários do próprio tenant.
  Não tem relação com este trabalho, mas merece revisão.

## Simulação de pagamento

Não faz parte deste trabalho, mas foi encontrado no caminho e corrigido junto.

`PAYMENT_SIMULATION_ENABLED` faz `AbacatePayGateway.createCheckout` devolver um
checkout falso sem chamar o provedor, e `POST /checkout/order/:id/confirm-simulation`
marcar o pedido como `PAID`. Ou seja: ingresso emitido sem cobrança.

O schema usava `z.coerce.boolean()`, que é `Boolean(string)`: `"false"` virava
`true`. Com `.default(true)`, a flag também ficava ligada quando ausente. Agora:

- `booleanFromEnv` interpreta as palavras e rejeita valores ambíguos no boot;
- o padrão é `false`;
- **a API recusa subir em produção com a flag ligada**, porque parser correto não
  é proteção suficiente para um bypass de cobrança;
- `.env.example` sugere `false`.
