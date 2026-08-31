# Event Flow - Staging Readiness Checklist

Atualizado em: 2026-08-16

## Validacao Executada

| Comando | Resultado |
| --- | --- |
| `git diff --check` | Limpo, sem erros de whitespace |
| `pnpm --filter @eventflow/api test` | 18 suites, 137 testes passaram |
| `pnpm --filter @eventflow/api build` | Prisma generate + Nest build OK |
| `pnpm --filter @eventflow/web build` | 34 paginas otimizadas, build OK |
| `pnpm --filter @eventflow/mobile test` | 5 testes passaram |
| `pnpm --filter @eventflow/mobile typecheck` | Sem erros de tipo |

## Registro de Validacao Local

### 2026-08-16

- Gates locais reexecutados antes do inicio operacional de staging.
- `git diff --check`: passou sem erros.
- `pnpm --filter @eventflow/api test`: 18 suites e 137 testes passaram.
- `pnpm --filter @eventflow/api build`: Prisma generate e Nest build passaram.
- `pnpm --filter @eventflow/web build`: build Next.js passou com 34 paginas geradas.
- `pnpm --filter @eventflow/mobile test`: 5 testes passaram. O primeiro disparo falhou por restricao de sandbox ao criar pipe IPC do `tsx`; o comando foi reexecutado fora do sandbox e passou.
- `pnpm --filter @eventflow/mobile typecheck`: passou sem erros.

## Registro de Infra Staging

### 2026-08-16

- Vercel configurado para a web.
- Time Vercel: `riquelmydevs-projects`.
- Projeto Vercel: `eventflow-web`.
- Project ID: `prj_dw9CY4ZOjp9twqnqM1e7Gvb16rzO`.
- Root directory: `apps/web`.
- Framework: Next.js.
- Install command: `pnpm install --frozen-lockfile`.
- Build command: `pnpm --filter @eventflow/web build`.
- Deployment ID: `dpl_5hGH3WxivgVCJVsLGoxcVRgSjnoH`.
- URL principal: `https://eventflow-web.vercel.app`.
- URL de deployment: `https://eventflow-fo9ba52au-riquelmydevs-projects.vercel.app`.
- Alias antigo removido apos rename.
- SSO deployment protection desativado para permitir acesso publico ao staging web.
- Verificacao HTTP da nova home publica: status 200.
- Verificacao HTTP da home: status 200.
- API publicada no Render e acessível pelo frontend através do proxy `/api/backend`.

## Registro de Preparacao da API Staging

### 2026-08-16

- API revisada para deploy em servico Node/Docker.
- `apps/api/Dockerfile` ajustado para usar `pnpm-lock.yaml` com `pnpm install --frozen-lockfile`.
- Healthcheck do container ajustado para respeitar `PORT`: `/api/health`.
- `pnpm --filter @eventflow/api test`: 18 suites e 137 testes passaram.
- `pnpm --filter @eventflow/api build`: Prisma generate e Nest build passaram.
- `git diff --check`: passou sem erros.
- Build Docker local nao executado porque o Docker daemon nao estava rodando.
- API hospedada no Render: serviço `eventflow-api-staging`, URL `https://eventflow-ctdc.onrender.com`.
- Render configurado para auto-deploy a partir da branch `master`, usando o `Dockerfile` da raiz.
- Healthcheck do serviço: `/api/health`.
- Banco PostgreSQL provisionado no Neon no projeto `eventflow-staging`.
- Storage público de assets provisionado no Cloudflare R2 no bucket `eventflow-assets-staging`.
- Pendente: confirmar e registrar apenas nas variáveis de ambiente as instâncias externas de Redis, RabbitMQ, SMTP e as credenciais AbacatePay sandbox.

## Registro de Banco Staging

### 2026-08-16

- Neon CLI autenticado localmente porque o OAuth do plugin retornou `Invalid redirect URI`.
- Projeto Neon criado: `eventflow-staging`.
- Project ID Neon: `royal-wildflower-24974285`.
- Organizacao Neon: `org-falling-firefly-87758675`.
- Regiao: `aws-us-east-1`.
- Database: `neondb`.
- PostgreSQL: 18.
- Connection string nao foi registrada na documentacao por ser secret.
- Migrations aplicadas inicialmente: 8.
- Seed inicial falhou por drift entre `schema.prisma` e migrations (`Tenant.city` ausente no banco).
- Criada migration `20260816213000_promoters_schema_sync` para alinhar promoters, campos de tenant/user/order e indices faltantes.
- `pnpm --filter @eventflow/api test`: 18 suites e 137 testes passaram antes da nova migration.
- `pnpm --filter @eventflow/api build`: Prisma generate e Nest build passaram antes da nova migration.
- `git diff --check`: passou sem erros.
- Migrations aplicadas apos correcao: 9.
- Seed staging executado com dados ficticios.
- `prisma migrate diff` contra o Neon staging retornou migration vazia, confirmando schema alinhado.
- Pendente: configurar `DATABASE_URL` como secret na hospedagem da API.

## Registro de Storage R2 Staging

### 2026-08-16

- API preparada para Cloudflare R2 usando interface S3-compatible.
- Adicionadas variaveis `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_ENDPOINT` e `AWS_S3_FORCE_PATH_STYLE`.
- Para Cloudflare R2, usar `AWS_REGION=auto`, `AWS_S3_FORCE_PATH_STYLE=true` e endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
- `pnpm --filter @eventflow/api test -- upload-storage.service.spec.ts env.schema.spec.ts`: 2 suites e 13 testes passaram.
- `pnpm --filter @eventflow/api test`: 18 suites e 140 testes passaram.
- `pnpm --filter @eventflow/api build`: Prisma generate e Nest build passaram.
- `git diff --check`: passou sem erros.
- Wrangler CLI autenticado na conta Cloudflare.
- Account ID Cloudflare: `b77a3d86099773b5d2300baa91421517`.
- Bucket R2 criado: `eventflow-assets-staging`.
- Storage class: Standard.
- Acesso publico `r2.dev` habilitado para staging.
- URL publica R2 staging: `https://pub-474447a5c61b4ecaa4cc55272d5c82ff.r2.dev`.
- Bucket vazio apos criacao: 0 objetos, 0 B.
- Bucket antigo removido apos rename para evitar recursos com nome legado.
- Regra operacional: este bucket publico deve receber apenas assets publicos de eventos, como banners, logos e imagens de galeria.
- Proibido armazenar documentos pessoais, relatorios, ingressos privados, comprovantes, QR payload completo ou qualquer dado sensivel neste bucket publico.
- Credenciais R2 S3 API regeradas para o bucket `eventflow-assets-staging`.
- Teste real R2 executado com credenciais novas: `ListObjectsV2`, `PutObject` em arquivo temporario, leitura publica via `r2.dev` com HTTP 200 e `DeleteObject` do arquivo temporario.
- Observacao: o Wrangler nao possui comando para criar essas credenciais, e a sessao OAuth atual nao autorizou a API de tokens da Cloudflare (`Unauthorized to access requested resource`).
- Procedimento seguro: criar a credencial em Cloudflare Dashboard > R2 > Overview > Manage API Tokens, escopo somente `eventflow-assets-staging`, copiar o Access Key ID e o Secret Access Key uma unica vez e configurar apenas como env vars da API.
- Variaveis R2 staging esperadas na hospedagem da API: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_ENDPOINT=https://b77a3d86099773b5d2300baa91421517.r2.cloudflarestorage.com`, `AWS_REGION=auto`, `AWS_S3_FORCE_PATH_STYLE=true`, `AWS_S3_ASSETS_BUCKET=eventflow-assets-staging`, `AWS_S3_ASSETS_PUBLIC_URL=https://pub-474447a5c61b4ecaa4cc55272d5c82ff.r2.dev`.
- Pendente: usar dominio customizado em producao caso assets publicos sejam mantidos em R2.

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

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_ASSETS_BUCKET`
- `AWS_S3_ASSETS_PUBLIC_URL`
- `AWS_S3_ENDPOINT` quando usar storage S3-compatible como Cloudflare R2
- `AWS_S3_FORCE_PATH_STYLE=true` quando usar Cloudflare R2

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
5. Verificar metricas em `/api/metrics`: `eventflow_webhooks_received_total`, `eventflow_webhooks_processed_total`.

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
| Webhook sem assinatura criptografica do provedor | Alta | Implementar verificacao de assinatura quando AbacatePay oferecer; monitorar `eventflow_webhooks_unmatched_total`. |
| Conciliacao financeira manual | Media | Dashboard financeiro mostra KPIs, mas conciliacao real contra extratos do provedor ainda nao esta automatizada. |
| Teste de carga nao executado | Media | Rodar k6/Artillery contra checkout e pagina publica antes de venda em alto volume. |
| 2FA enterprise e fluxo real | Media | Modelo existe, mas fluxo de provisioning TOTP/app authenticator nao esta testado end-to-end. |
| Backup e restore nao exercitados | Media | Job de backup existe, mas restore real nunca foi testado. |
| LGPD: consentimento e retencao | Media | Modelos e anonimizacao existem; revisar termos legais e fluxo de exclusao antes de vender. |
| Lock distribuido para seat holds | Baixa | Reserva de assentos usa Prisma, mas carga alta pode exigir Redis lock. |
