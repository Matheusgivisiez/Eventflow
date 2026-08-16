# EventHub - Staging Readiness Checklist

Atualizado em: 2026-08-16

## Validacao Executada

| Comando | Resultado |
| --- | --- |
| `git diff --check` | Limpo, sem erros de whitespace |
| `pnpm --filter @eventhub/api test` | 18 suites, 137 testes passaram |
| `pnpm --filter @eventhub/api build` | Prisma generate + Nest build OK |
| `pnpm --filter @eventhub/web build` | 34 paginas otimizadas, build OK |
| `pnpm --filter @eventhub/mobile test` | 5 testes passaram |
| `pnpm --filter @eventhub/mobile typecheck` | Sem erros de tipo |

## Registro de Validacao Local

### 2026-08-16

- Gates locais reexecutados antes do inicio operacional de staging.
- `git diff --check`: passou sem erros.
- `pnpm --filter @eventhub/api test`: 18 suites e 137 testes passaram.
- `pnpm --filter @eventhub/api build`: Prisma generate e Nest build passaram.
- `pnpm --filter @eventhub/web build`: build Next.js passou com 34 paginas geradas.
- `pnpm --filter @eventhub/mobile test`: 5 testes passaram. O primeiro disparo falhou por restricao de sandbox ao criar pipe IPC do `tsx`; o comando foi reexecutado fora do sandbox e passou.
- `pnpm --filter @eventhub/mobile typecheck`: passou sem erros.

## Registro de Infra Staging

### 2026-08-16

- Vercel configurado para a web.
- Time Vercel: `riquelmydevs-projects`.
- Projeto Vercel: `eventhub-web`.
- Project ID: `prj_dw9CY4ZOjp9twqnqM1e7Gvb16rzO`.
- Root directory: `apps/web`.
- Framework: Next.js.
- Install command: `pnpm install --frozen-lockfile`.
- Build command: `pnpm --filter @eventhub/web build`.
- Deployment ID: `dpl_5hGH3WxivgVCJVsLGoxcVRgSjnoH`.
- URL principal: `https://eventhub-web-ten.vercel.app`.
- URL de deployment: `https://eventhub-39jhmq8c3-riquelmydevs-projects.vercel.app`.
- Verificacao HTTP da home: status 200.
- Pendente: configurar `NEXT_PUBLIC_API_URL` quando a API staging estiver publicada.

## Registro de Preparacao da API Staging

### 2026-08-16

- API revisada para deploy em servico Node/Docker gratuito.
- `apps/api/Dockerfile` ajustado para usar `pnpm-lock.yaml` com `pnpm install --frozen-lockfile`.
- Healthcheck do container ajustado para respeitar `PORT`: `/api/health`.
- `pnpm --filter @eventhub/api test`: 18 suites e 137 testes passaram.
- `pnpm --filter @eventhub/api build`: Prisma generate e Nest build passaram.
- `git diff --check`: passou sem erros.
- Build Docker local nao executado porque o Docker daemon nao estava rodando.
- Plataforma recomendada para API staging: Koyeb Free.
- Pendente: criar/configurar conta Koyeb ou fornecer token/CLI autenticado.
- Pendente: provisionar `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, SMTP, S3/CDN e credenciais AbacatePay sandbox.
- Pendente: configurar env vars da API staging e executar migrations.

## Registro de Banco Staging

### 2026-08-16

- Neon CLI autenticado localmente porque o OAuth do plugin retornou `Invalid redirect URI`.
- Projeto Neon criado: `eventhub-staging`.
- Project ID Neon: `royal-wildflower-24974285`.
- Organizacao Neon: `org-falling-firefly-87758675`.
- Regiao: `aws-us-east-1`.
- Database: `neondb`.
- PostgreSQL: 18.
- Connection string nao foi registrada na documentacao por ser secret.
- Migrations aplicadas inicialmente: 8.
- Seed inicial falhou por drift entre `schema.prisma` e migrations (`Tenant.city` ausente no banco).
- Criada migration `20260816213000_promoters_schema_sync` para alinhar promoters, campos de tenant/user/order e indices faltantes.
- `pnpm --filter @eventhub/api test`: 18 suites e 137 testes passaram antes da nova migration.
- `pnpm --filter @eventhub/api build`: Prisma generate e Nest build passaram antes da nova migration.
- `git diff --check`: passou sem erros.
- Migrations aplicadas apos correcao: 9.
- Seed staging executado com dados ficticios.
- `prisma migrate diff` contra o Neon staging retornou migration vazia, confirmando schema alinhado.
- Pendente: configurar `DATABASE_URL` como secret na hospedagem da API.

## Variaveis Obrigatorias de Producao

Todas as variaveis abaixo sao exigidas pelo `envSchema` quando `NODE_ENV=production`. A API falha ao iniciar se estiverem ausentes ou fracas.

### Secrets (minimo 32 caracteres, nao podem ser valores fracos)

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_RESET_SECRET`
- `QR_CODE_SECRET`

### SMTP (recuperacao de senha)

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### Storage externo (uploads)

- `AWS_S3_ASSETS_BUCKET`
- `AWS_S3_ASSETS_PUBLIC_URL`

### Infraestrutura

- `DATABASE_URL` (PostgreSQL)
- `REDIS_URL`
- `RABBITMQ_URL`
- `APP_URL` (URL do frontend)
- `API_URL` (URL da API)

### Pagamentos

- `ABACATE_API_KEY` ou `ABACATEPAY_API_KEY` (credenciais do provedor)
- `ABACATE_WEBHOOK_SECRET` ou `ABACATEPAY_WEBHOOK_SECRET`
- `ABACATE_ENVIRONMENT=production`

## Servicos Externos Necessarios

- **PostgreSQL**: banco principal com migrations aplicadas.
- **Redis**: cache, sessoes e filas.
- **RabbitMQ**: processamento de jobs (reports, LGPD, etc).
- **S3 + CloudFront**: armazenamento de assets/uploads com URL publica.
- **Provedor SMTP**: envio de emails transacionais (recuperacao de senha).
- **AbacatePay**: gateway de pagamento com webhook configurado.

## Passos para Aplicar Migrations

```bash
# Em staging, com DATABASE_URL apontando para o banco correto:
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

A migration `20260815120000_order_stock_reservation` adiciona:
- `Order.stockReservedAt` (DateTime nullable)
- `Order.orderAccessToken` (String nullable, unique index)

## Testar Checkout

1. Configurar `ABACATE_ENVIRONMENT=sandbox` e credenciais de sandbox.
2. Criar evento com lote de ingressos.
3. Fazer checkout via web: preencher dados do comprador, selecionar ingressos.
4. Verificar que pedido foi criado com `stockReservedAt` preenchido.
5. Verificar URL de sucesso com `orderId` e `accessToken`.
6. Testar consulta publica do pedido sem `accessToken` (deve retornar 401).
7. Testar dois checkouts simultaneos para o ultimo ingresso (apenas um deve criar pedido).

## Testar Webhook

1. Configurar `ABACATE_WEBHOOK_SECRET` com o secret do sandbox.
2. Completar pagamento no sandbox.
3. Verificar que webhook processou: pagamento `PAID`, tickets emitidos, ledger criado.
4. Enviar webhook duplicado: verificar idempotencia (nao cria tickets/ledger duplicados).
5. Verificar metricas em `/api/metrics`: `eventhub_webhooks_received_total`, `eventhub_webhooks_processed_total`.

## Testar Upload S3

1. Configurar `AWS_S3_ASSETS_BUCKET` e `AWS_S3_ASSETS_PUBLIC_URL`.
2. Fazer upload de imagem via API (requer JWT).
3. Verificar que a URL retornada aponta para o bucket/CDN correto.
4. Tentar upload de arquivo com extensao invalida ou assinatura adulterada (deve ser rejeitado).

## Testar Mobile Check-in

1. Instalar app mobile com `API_URL` apontando para staging.
2. Fazer login com email/senha de operador com permissao `CHECK_IN`.
3. Verificar que device e registrado em `/enterprise/mobile/devices`.
4. Escanear QR Code de ingresso valido: check-in deve ser aceito.
5. Escanear novamente: deve retornar status duplicado.
6. Escanear QR adulterado: deve ser rejeitado antes de consultar banco.

## Riscos Restantes Antes de Producao

| Risco | Severidade | Mitigacao |
| --- | --- | --- |
| Webhook sem assinatura criptografica do provedor | Alta | Implementar verificacao de assinatura quando AbacatePay oferecer; monitorar `eventhub_webhooks_unmatched_total`. |
| Conciliacao financeira manual | Media | Dashboard financeiro mostra KPIs, mas conciliacao real contra extratos do provedor ainda nao esta automatizada. |
| Teste de carga nao executado | Media | Rodar k6/Artillery contra checkout e pagina publica antes de venda em alto volume. |
| 2FA enterprise e fluxo real | Media | Modelo existe, mas fluxo de provisioning TOTP/app authenticator nao esta testado end-to-end. |
| Backup e restore nao exercitados | Media | Job de backup existe, mas restore real nunca foi testado. |
| LGPD: consentimento e retencao | Media | Modelos e anonimizacao existem; revisar termos legais e fluxo de exclusao antes de vender. |
| Lock distribuido para seat holds | Baixa | Reserva de assentos usa Prisma, mas carga alta pode exigir Redis lock. |
