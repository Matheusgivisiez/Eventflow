# Runbook: deploy da compra como convidado

Cobre os commits de verificação de e-mail, confirmação de compra e retentativa.
Execute na ordem. Cada passo tem o que olhar antes de seguir.

---

## Passo 0 (BLOQUEADOR): como o Render inicia a API?

O repositório tem **dois** caminhos de inicialização, e eles fazem coisas
diferentes com o banco:

| Caminho | Comando | Efeito |
|---|---|---|
| `Dockerfile` (CMD) | `prisma migrate deploy` | aplica as migrações **e os backfills** |
| `apps/api/package.json` (`start`) | `prisma db push` | sincroniza o schema e **ignora os backfills** |

`prisma db push` cria as colunas novas mas **não executa nenhum `UPDATE`**. Se o
Render usar esse caminho, o resultado no deploy é:

- `User.emailVerifiedAt` fica `NULL` para **todo mundo** — toda conta existente
  perde acesso aos próprios ingressos até confirmar o e-mail;
- `NotificationLog.status` fica `PENDING` nas linhas antigas, e a retentativa
  passa a enviar confirmação de compras dos últimos 7 dias;
- `NotificationLog.claimedAt` fica `NULL` em linhas já encerradas.

**Verifique no painel do Render** se o serviço é Docker (usa o `Dockerfile`) ou
Node (usa `pnpm start`).

- **Docker** → nada a fazer, as migrações rodam sozinhas.
- **Node** → faça uma das duas coisas antes de subir:
  1. trocar o start command do serviço para
     `pnpm --filter @eventflow/api exec prisma migrate deploy && node apps/api/dist/main.js`; ou
  2. aplicar as migrações manualmente contra o Neon, antes do deploy:
     `DATABASE_URL="<url do Neon>" pnpm --filter @eventflow/api exec prisma migrate deploy`

Não siga adiante sem resolver isto.

---

## Passo 1: auditoria do legado

Antes da primeira migração, contra o banco de produção:

```
apps/api/prisma/scripts/auditoria-contas-vs-pedidos-convidado.sql
```

Lista contas que passariam a alcançar pedidos de convidado que não são delas.
Para qualquer suspeita, depois do deploy:
`UPDATE "User" SET "emailVerifiedAt" = NULL WHERE "id" IN ('...');`

Se a lista vier vazia, siga.

---

## Passo 2: variáveis no Render

| Variável | Valor esperado | Se estiver errado |
|---|---|---|
| `NODE_ENV` | `production` | sem isso, a trava de simulação e a exigência de SMTP não valem |
| `PAYMENT_SIMULATION_ENABLED` | `false` ou ausente | **emite ingresso sem cobrar** |
| `APP_URL` | URL pública do web | os links do e-mail apontam para o lugar errado |
| `SMTP_HOST/PORT/USER/PASS/FROM` | preenchidos | em produção a API nem sobe sem eles |
| `PURCHASE_EMAIL_ENABLED` | `true` ou ausente | sem e-mail de confirmação |
| `NOTIFICATION_RETRY_ENABLED` | `true` ou ausente | sem retentativa automática |

Se a API recusar subir com
`PAYMENT_SIMULATION_ENABLED must be false in production`, **a trava está
funcionando**. Corrija a variável; não remova a trava.

---

## Passo 3: portões locais

```
pnpm --filter @eventflow/api prisma:generate
pnpm --filter @eventflow/api test
pnpm --filter @eventflow/api build
pnpm --filter @eventflow/web build
pnpm --filter @eventflow/api dev     # sobe, confere as rotas, derruba
```

Espere: testes verdes e o Nest mapeando as rotas, incluindo
`POST /auth/verify-email` e `POST /auth/resend-verification`.

---

## Passo 4: merge e deploy

```
git checkout master
git merge feat/verificacao-email
git push origin master
```

Suba **API e web na mesma janela**: `/verificar-email` é o destino do link que a
API envia. Web no ar sem API nova = link 404. API nova sem web = e-mail com
link quebrado.

Ordem: API primeiro (ela aplica as migrações), web em seguida.

---

## Passo 5: verificação pós-deploy

Antes de qualquer teste de compra:

1. `GET /api/health` respondendo.
2. Nos logs da API, confirmar que as migrações aplicaram e que **não** apareceu
   `SMTP nao configurado`.
3. No banco: `SELECT COUNT(*) FROM "User" WHERE "emailVerifiedAt" IS NULL;`
   Se vier um número alto, o backfill não rodou — volte ao Passo 0.

---

## Passo 6: compra de verdade

Com seu cartão, no ambiente real, **sem estar logado**:

1. abrir o evento, comprar como convidado;
2. pagar;
3. a página de sucesso mostra o ingresso e **não** redireciona para o login;
4. a página diz "Enviamos este link para ..." — se disser "Salve o endereço
   desta página agora", o e-mail **não** saiu: pare e veja o Passo 5.2;
5. o e-mail chega na **caixa de entrada**, não no spam;
6. abrir o link do e-mail em uma janela anônima: o pedido aparece;
7. criar conta com o mesmo e-mail;
8. confirmar o e-mail pelo link;
9. o ingresso antigo aparece em Meus Ingressos.

Depois repita de outro aparelho e outro e-mail (Gmail, Outlook, Hotmail), para
medir entregabilidade em mais de um provedor.

Teste negativo, igualmente importante: criar uma conta com um e-mail **de
terceiro** que tenha pedidos, e confirmar que **nada** aparece em Meus
Ingressos antes da confirmação.

---

## Quando reverter

Reverta o deploy se:

- usuários existentes aparecerem com `emailVerifiedAt` nulo em massa;
- a página de sucesso não mostrar o ingresso para o convidado;
- a confirmação de compra chegar duplicada para o mesmo pedido.

`git revert` dos commits e redeploy. As migrações são **aditivas**: as colunas
novas continuam no banco sem quebrar a versão antiga do código, então reverter a
aplicação é seguro e não exige desfazer o banco.
