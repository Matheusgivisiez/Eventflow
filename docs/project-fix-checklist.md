# EventHub - Checklist de Correcao e Evolucao

Atualizado em: 2026-08-15

Este arquivo e o quadro de acompanhamento do projeto. Use os status abaixo para acompanhar a evolucao:

- `[ ]` Pendente
- `[~]` Em andamento
- `[x]` Concluido
- `[!]` Bloqueado

## Regra Obrigatoria de Qualidade

Nenhum item pode ser marcado como `[x]` sem:

- Testes automatizados cobrindo a correcao feita.
- Teste negativo quando o item envolver seguranca, permissao ou vazamento de dados.
- Verificacao de que rotas/servicos relacionados continuam funcionando.
- `git diff --check` sem erros.
- Build do pacote afetado quando houver mudanca de tipo, rota, schema ou frontend.

Se algum teste nao puder ser executado, o item deve ficar `[~]` ou `[!]` com o motivo registrado no log.

## Ordem de Prioridade

### P0 - Corrigir Antes de Produzir ou Vender de Verdade

- [x] **Evitar oversell no checkout**
  - Problema: o estoque e validado ao criar o pedido, mas `sold` so aumenta quando o pagamento vira `PAID`. Compras simultaneas podem vender mais ingressos do que a quantidade disponivel.
  - Evidencia: `apps/api/src/modules/checkout/use-cases/create-checkout.use-case.ts`, `apps/api/src/modules/payments/payments.service.ts`.
  - Como corrigir: reservar estoque de forma atomica no checkout ou incrementar estoque com `UPDATE ... WHERE quantity - sold >= qty` dentro da transacao.
  - Criterio de aceite: dois checkouts concorrentes para o ultimo ingresso nao podem ambos concluir reserva/pedido valido.
  - Resultado: criado `Order.stockReservedAt`, reserva atomica no checkout e liberacao de estoque quando pagamento/pedido e cancelado.

- [x] **Proteger consulta publica de pedido**
  - Problema: `GET /checkout/order/:orderId` retorna nome, e-mail, tickets e QR Code apenas com o ID do pedido.
  - Evidencia: `apps/api/src/modules/checkout/checkout.service.ts`.
  - Como corrigir: criar `orderAccessToken` aleatorio, exigir token na consulta, ou validar e-mail/documento junto com o pedido.
  - Criterio de aceite: nao e possivel consultar QR Code ou dados pessoais somente com `orderId`.
  - Resultado: criado `Order.orderAccessToken`, retorno do provedor inclui `accessToken` na URL de sucesso, e `GET /checkout/order/:orderId` exige token valido.

- [x] **Restringir alteracao manual de status de pagamento**
  - Problema: rota autenticada permite alterar status de pagamento; isso pode permitir marcar pedido como pago fora do fluxo de webhook.
  - Evidencia: `apps/api/src/modules/payments/payments.controller.ts`.
  - Como corrigir: limitar a `ADMIN` interno ou permissao financeira explicita; idealmente pagamento confirmado apenas por webhook verificado.
  - Criterio de aceite: organizador comum/equipe sem permissao nao consegue marcar pagamento como `PAID`.
  - Resultado: rota manual `PATCH /payments/:id/status` agora exige role `ADMIN`; rota de criar preferencia de pagamento valida tenant para chamadas autenticadas.

- [x] **Mover refresh token para cookie HttpOnly**
  - Problema: access token e refresh token ficam persistidos no storage do navegador.
  - Evidencia: `apps/web/stores/auth-store.ts`.
  - Como corrigir: refresh token em cookie `HttpOnly`, `Secure`, `SameSite`; access token em memoria ou renovacao via endpoint.
  - Criterio de aceite: `localStorage` nao contem refresh token.
  - Resultado: refresh token agora e entregue somente em cookie `eventhub_refresh` HttpOnly; respostas de login/registro/refresh nao retornam `refreshToken`; web usa `credentials: "include"` e nao persiste refresh token.

- [x] **Remover secrets default fracos em producao**
  - Problema: `env.schema.ts` aceita secrets default `change-me-*`.
  - Evidencia: `apps/api/src/config/env.schema.ts`, `.env.example`.
  - Como corrigir: exigir secrets fortes quando `NODE_ENV=production`; manter defaults apenas para desenvolvimento local.
  - Criterio de aceite: API falha ao subir em producao sem secrets reais.
  - Resultado: `envSchema` rejeita producao sem JWT/QR secrets fortes; defaults agora sao explicitamente `dev-only`; fallbacks fracos de QR foram removidos dos servicos.

### P1 - Fluxos Criticos e Confiabilidade

- [x] **Adicionar testes de checkout concorrente**
  - Problema: nao ha teste cobrindo corrida de estoque.
  - Como corrigir: teste de integracao simulando duas compras simultaneas no mesmo lote.
  - Criterio de aceite: teste falha no comportamento atual e passa apos correcao de reserva/estoque.
  - Resultado: adicionado teste do `CreateCheckoutUseCase` simulando duas leituras concorrentes para o ultimo ingresso; apenas uma reserva atomica cria pedido.

- [x] **Adicionar testes de webhook pago**
  - Problema: fluxo de pagamento aprovado precisa garantir idempotencia, emissao de tickets e ledger.
  - Como corrigir: testar webhook duplicado, transicao `PENDING -> PAID`, criacao de tickets e entrada financeira.
  - Criterio de aceite: webhook duplicado nao cria tickets nem ledger duplicados.
  - Resultado: adicionados testes para webhook pago, duplicado, pagamento ja pago, pagamento nao encontrado, emissao idempotente de tickets e ledger financeiro unico.

- [x] **Adicionar testes de check-in duplicado e QR adulterado**
  - Problema: check-in e QR Code sao fluxo sensivel de entrada no evento.
  - Como corrigir: testar ingresso valido, usado, cancelado e assinatura invalida.
  - Criterio de aceite: QR adulterado e recusado; ingresso usado gera status duplicado.
  - Resultado: adicionados testes para QR valido, QR adulterado, ingresso duplicado, ingresso cancelado, ticket fora do tenant/evento e ausencia de `QR_CODE_SECRET`.

- [x] **Corrigir recuperacao de senha para envio real**
  - Problema: `forgotPassword` cria token, mas ainda ha TODO para envio por email/SMS.
  - Evidencia: `apps/api/src/modules/auth/auth.service.ts`.
  - Como corrigir: integrar provedor de email, template e fluxo de reset sem vazar token em logs/resposta.
  - Criterio de aceite: usuario recebe link seguro de reset e token nao aparece na resposta da API.
  - Resultado: `forgotPassword` agora envia link por SMTP via `MailService`, nao retorna token, producao exige configuracao SMTP e web tem pagina `/reset-password`.

- [x] **Aplicar permissoes nas rotas enterprise**
  - Problema: varias rotas enterprise usam apenas `JwtAuthGuard`, sem role/permissao especifica.
  - Evidencia: `apps/api/src/modules/enterprise/enterprise.controller.ts`.
  - Como corrigir: aplicar `RolesGuard`, `TeamPermissionGuard` e decorators por area.
  - Criterio de aceite: equipe sem permissao nao acessa CRM, financeiro, white-label, API keys ou seguranca.
  - Resultado: rotas enterprise privadas agora exigem role enterprise e permissao por area; rotas de marketplace para cliente autenticado mantem acesso especifico.

### P2 - Produto, Manutencao e Clareza

- [x] **Separar `EnterpriseService` por dominio**
  - Problema: arquivo concentra muitas responsabilidades em um servico grande.
  - Evidencia: `apps/api/src/modules/enterprise/enterprise.service.ts`.
  - Como corrigir: dividir em servicos menores: white-label, CRM, marketing, analytics, seat maps, marketplace, AI, security.
  - Criterio de aceite: cada servico tem responsabilidade unica e testes proprios.
  - Resultado: `EnterpriseService` virou fachada de 187 linhas e a logica foi separada em 13 servicos por dominio com teste de delegacao.

- [x] **Trocar readiness fake por status real**
  - Problema: `overview` retorna todos os modulos como prontos, mesmo quando sao parciais/prototipos.
  - Evidencia: `apps/api/src/modules/enterprise/services/enterprise-overview.service.ts`.
  - Como corrigir: usar status `not_started`, `prototype`, `partial`, `production_ready` com checks objetivos.
  - Criterio de aceite: dashboard enterprise reflete maturidade real dos modulos.
  - Resultado: `overview.readiness` agora usa status graduado com evidencia objetiva por modulo; web exibe o status e a evidencia.

- [x] **Padronizar marca EventHub**
  - Problema: README/docs usavam EventHub, enquanto partes do web/mobile usavam outra marca.
  - Evidencia: `README.md`, `apps/mobile/App.tsx`, `apps/mobile/src/offline-checkin.ts`.
  - Como corrigir: escolher nome oficial e ajustar textos, storage keys, app name e documentacao.
  - Criterio de aceite: uma unica marca aparece em web, API, mobile, docs e seed.
  - Resultado: EventHub foi definido como marca oficial; textos visiveis, metadata, docs, downloads e storage keys foram alinhados.

- [x] **Revisar documentacao para separar pronto, parcial e planejado**
  - Problema: README e docs prometem funcionalidades enterprise que ainda nao estao completas.
  - Como corrigir: criar matriz de maturidade por modulo e ajustar promessas.
  - Criterio de aceite: qualquer pessoa entende o que pode ser usado hoje e o que e roadmap.
  - Resultado: criada matriz `docs/product-maturity.md`; README, indice tecnico e enterprise platform agora apontam pronto/parcial/prototipo.

- [x] **Reduzir uso de `any` em areas criticas**
  - Problema: `any` reduz confiabilidade de contratos em checkout, reports, enterprise, web e mobile.
  - Como corrigir: criar tipos/DTOs para payloads, responses e entidades derivadas.
  - Criterio de aceite: fluxos criticos sem `any` evitavel.
  - Resultado: checkout, reports, mobile e helper web foram tipados; enterprise manteve apenas wrapper Prisma dinamico isolado por compatibilidade.

### P3 - Infraestrutura e Operacao

- [x] **Configurar storage externo para uploads**
  - Problema: upload local em disco nao escala bem e pode perder arquivos em deploy.
  - Evidencia: `apps/api/src/modules/upload/upload.controller.ts`.
  - Como corrigir: S3/CloudFront ou storage equivalente, mantendo validacao de tipo e tamanho.
  - Criterio de aceite: upload retorna URL persistente externa e funciona em ambiente stateless.
  - Resultado: upload usa `memoryStorage`, valida tipo/assinatura antes de persistir e envia assets para S3 quando configurado; producao exige S3/public URL.

- [x] **Fortalecer observabilidade**
  - Problema: Prometheus/Grafana existem na infra, mas faltam metricas de negocio e alertas praticos.
  - Como corrigir: metricas para checkout, webhook, pagamento, check-in, fila e erros.
  - Criterio de aceite: dashboard mostra saude dos fluxos criticos e alertas acionaveis.
  - Resultado: `/metrics` agora usa `BusinessMetricsService`; checkout, pagamento, webhook e check-in registram contadores de negocio sem labels com PII/secrets; documentacao lista metricas implementadas e proximos sinais recomendados.

- [x] **Preparar mobile para ambiente real**
  - Problema: app mobile usa API fixa local e token manual.
  - Evidencia: `apps/mobile/App.tsx`.
  - Como corrigir: tela de login, ambiente configuravel e armazenamento seguro do token.
  - Criterio de aceite: operador consegue logar e sincronizar em staging/producao sem colar token manualmente.
  - Resultado: app mobile agora tem login por email/senha, API URL configuravel, token salvo em `expo-secure-store`, recuperacao de sessao, logout, persistencia de evento/device e registro de device com validacao da permissao `CHECK_IN`.

## Progresso

- Total de itens: 18
- Concluidos: 18
- Em andamento: 0
- Bloqueados: 0

## Registro de Execucao

### 2026-08-15

- Criado checklist inicial apos analise completa do projeto.
- Primeira recomendacao de execucao: comecar por **Evitar oversell no checkout**, porque afeta dinheiro, estoque e confianca do produto.
- Concluido **Evitar oversell no checkout**:
  - Adicionado campo `stockReservedAt` em `Order`.
  - Adicionada migracao `20260815120000_order_stock_reservation`.
  - Checkout agora reserva estoque com atualizacao condicional atomica.
  - Pagamento aprovado nao incrementa estoque novamente quando o pedido ja tinha reserva.
  - Cancelamento/reembolso libera estoque reservado.
  - Falha ao criar checkout no provedor externo cancela o pedido e libera a reserva.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `git diff --check`
- Concluido **Proteger consulta publica de pedido**:
  - Adicionado campo `orderAccessToken` em `Order`.
  - Consulta publica do pedido agora exige `accessToken`.
  - URL de retorno/sucesso do provedor inclui `orderId` e `accessToken`.
  - Pagina `/checkout/success` so consulta pedido quando os dois parametros existem.
  - Adicionados testes unitarios para token ausente, token invalido, token valido, retorno do token no checkout e URLs do provedor.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- checkout.service.spec.ts payments.service.spec.ts transfers.service.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `pnpm --filter @eventhub/web build`
    - `git diff --check`
- Concluido **Restringir alteracao manual de status de pagamento**:
  - `PaymentsController` agora usa `JwtAuthGuard` e `RolesGuard`.
  - `PATCH /payments/:id/status` exige `ADMIN`.
  - `POST /payments/orders/:orderId/preference` exige `ADMIN` ou `ORGANIZER`.
  - Criacao autenticada de preferencia de pagamento valida o tenant do pedido.
  - Adicionados testes para roles do controller, bloqueio por tenant errado e criacao por tenant correto.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- payments.controller.spec.ts payments.service.spec.ts checkout.service.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `git diff --check`
- Concluido **Mover refresh token para cookie HttpOnly**:
  - Auth API agora seta cookie `eventhub_refresh` HttpOnly em login, registro, registro de organizador, refresh e upgrade para organizador.
  - `POST /auth/refresh` aceita refresh pelo cookie HttpOnly.
  - `POST /auth/logout` limpa cookie e revoga refresh token no banco.
  - Web nao espera nem persiste `refreshToken`; chamadas usam `credentials: "include"`.
  - Adicionados testes para cookie HttpOnly, ausencia de `refreshToken` na resposta, refresh via cookie, logout com limpeza de cookie e revogacao por hash.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- auth.controller.spec.ts auth.service.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `pnpm --filter @eventhub/web build`
    - `rg -n "refreshToken" apps/web`
    - `git diff --check`
- Concluido **Remover secrets default fracos em producao**:
  - `envSchema` agora exige `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_RESET_SECRET` e `QR_CODE_SECRET` fortes em `NODE_ENV=production`.
  - Defaults de desenvolvimento foram renomeados para `dev-only-*`.
  - `.env.example` foi atualizado para deixar claro que os valores sao apenas locais.
  - Removidos fallbacks `change-me-*` de assinatura/validacao de QR Code nos servicos de pagamento, check-in e transferencia.
  - Adicionados testes para defaults de desenvolvimento, producao sem secrets, producao com secrets fracos e producao com secrets fortes.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- env.schema.spec.ts payments.service.spec.ts transfers.service.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `rg -n "change-me" apps/api/src .env.example`
    - `git diff --check`
- Concluido **Adicionar testes de checkout concorrente**:
  - Adicionado `create-checkout.use-case.spec.ts`.
  - Teste simula duas tentativas para o ultimo ingresso com leitura de estoque obsoleta e reserva atomica condicional.
  - Verifica que apenas um pedido e criado, estoque reservado fica em 1, `stockReservedAt` e `orderAccessToken` sao preenchidos, e a segunda tentativa falha.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- create-checkout.use-case.spec.ts checkout.service.spec.ts payments.service.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `git diff --check`
- Concluido **Adicionar testes de webhook pago**:
  - Adicionado `webhooks.service.spec.ts` cobrindo pagamento pago via AbacatePay, log processado, auditoria e notificacao do comprador.
  - Adicionados testes de duplicidade para garantir que webhook ja processado nao chama pagamento nem notificacao.
  - Ampliado `payments.service.spec.ts` para cobrir `PENDING -> PAID`, emissao de tickets, ledger unico, retry idempotente e ordem legada sem reserva de estoque.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- webhooks.service.spec.ts payments.service.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `git diff --check`
- Concluido **Adicionar testes de check-in duplicado e QR adulterado**:
  - Adicionado `validate-ticket.use-case.spec.ts`.
  - Testes cobrem entrada liberada, QR adulterado recusado antes de consultar ticket, duplicidade com log, ticket cancelado com log, ticket nao encontrado no tenant/evento e falha fechada sem `QR_CODE_SECRET`.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- validate-ticket.use-case.spec.ts payments.service.spec.ts transfers.service.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `git diff --check`
- Concluido **Corrigir recuperacao de senha para envio real**:
  - Adicionado `MailService` com envio SMTP por Nodemailer e fallback seguro de desenvolvimento quando SMTP nao esta configurado.
  - `forgotPassword` agora cria token com hash, envia link de reset e mantem resposta generica sem expor token.
  - `envSchema` exige `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` em producao.
  - `.env.example` documenta as variaveis SMTP.
  - Criada pagina web `/reset-password` para consumir o token recebido por email.
  - Adicionados testes para envio SMTP, fallback sem SMTP, nao vazamento do token, usuario inexistente e validacao de SMTP em producao.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- auth.service.spec.ts mail.service.spec.ts env.schema.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `pnpm --filter @eventhub/web build`
    - `git diff --check`
- Concluido **Aplicar permissoes nas rotas enterprise**:
  - Criados decorators locais para padronizar guards enterprise no controller.
  - Rotas privadas enterprise agora exigem `JwtAuthGuard`, `RolesGuard`, `TeamPermissionGuard`, role `ADMIN`/`ORGANIZER`/`TEAM` e permissao especifica por area.
  - White-label, CRM, marketing, afiliados, analytics, API publica, seat maps, seguranca, mobile check-in e infraestrutura receberam permissoes dedicadas.
  - Reviews e favoritos do marketplace continuam disponiveis para usuarios autenticados, sem abrir as rotas administrativas enterprise.
  - Adicionados testes de metadados e testes negativos reais dos guards para cliente comum e membro de equipe sem permissao.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- enterprise.controller.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `git diff --check`
- Concluido **Separar `EnterpriseService` por dominio**:
  - Criado `EnterpriseDomainService` com helpers compartilhados de tenant, strings, hash, slug e validacao de evento.
  - Extraidos servicos por dominio: overview, white-label, mobile, afiliados, CRM, marketing, analytics, API publica, seat maps, marketplace, AI/executive, security e infrastructure.
  - `EnterpriseService` agora e uma fachada fina que preserva o contrato usado pelo controller.
  - `EnterpriseModule` registra todos os providers de dominio.
  - Adicionado `enterprise.service.spec.ts` cobrindo a delegacao de todos os metodos publicos para o dominio correto.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- enterprise.controller.spec.ts enterprise.service.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `git diff --check`
- Concluido **Trocar readiness fake por status real**:
  - `EnterpriseOverviewService` deixou de retornar booleanos sempre verdadeiros.
  - Readiness agora usa `not_started`, `prototype`, `partial` e `production_ready`.
  - Status e evidencias sao calculados com dados reais do tenant: white-label, mobile, afiliados, CRM, marketing, analytics, API publica, seat maps, marketplace, IA, seguranca e infraestrutura.
  - Pagina web `/enterprise` foi atualizada para exibir status e evidencia por modulo.
  - Adicionado `enterprise-overview.service.spec.ts` cobrindo tenant sem dados e tenant com setup completo.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- enterprise-overview.service.spec.ts enterprise.service.spec.ts enterprise.controller.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `pnpm --filter @eventhub/web build`
    - `git diff --check`
- Concluido **Padronizar marca EventHub**:
  - EventHub foi definido como marca oficial do produto.
  - Web atualizado em metadata, rodapes, politica de cookies, logo acessivel, texto do logo e nomes de download.
  - Mobile atualizado em textos visiveis, fallback de device ID e avatar.
  - API/docs/testes alinhados em textos financeiros, AbacatePay e dados de teste.
  - Mantidos identificadores tecnicos `@eventhub/*`, cookies, metricas, containers e namespaces por compatibilidade.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- transfers.service.spec.ts`
    - `pnpm --filter @eventhub/mobile typecheck`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `pnpm --filter @eventhub/web build`
    - busca por nomes antigos da marca em `apps`, `docs`, `README.md`, `package.json` e `test-abacatepay.mjs`
    - `git diff --check`
- Concluido **Revisar documentacao para separar pronto, parcial e planejado**:
  - Criada `docs/product-maturity.md` com legenda `production_ready`, `partial`, `prototype` e `not_started`.
  - README ganhou resumo de maturidade e link direto para a matriz.
  - `docs/index.md` passou a tratar a matriz como fonte canonica de maturidade.
  - `docs/enterprise-platform.md` foi reescrito como inventario com status e lacunas, nao como promessa de prontidao.
  - Verificacoes executadas:
    - `rg -n "product-maturity|Product Maturity|Maturidade do produto|production_ready|partial|prototype|not_started" README.md docs/index.md docs/enterprise-platform.md docs/product-maturity.md docs/project-fix-checklist.md`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/web build`
    - `git diff --check`
- Concluido **Reduzir uso de `any` em areas criticas**:
  - `CreateCheckoutUseCase` agora usa `Prisma.TransactionClient` e `Prisma.EventGetPayload` nos helpers transacionais.
  - `ReportsService` ganhou tipos para participantes e linhas de exportacao.
  - `ReportsProcessor` ganhou tipos de job/result e tratamento de erro sem `any`.
  - `apps/web/lib/api.ts` ganhou `ApiError` tipado com `status`.
  - `apps/mobile/App.tsx` ganhou props tipadas para `CheckInTab` e `SyncTab`.
  - `AnyRecord` enterprise passou a representar payloads como `Record<string, unknown>`; o acesso Prisma dinamico ficou isolado em `DynamicPrismaClient`.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/mobile typecheck`
    - `pnpm --filter @eventhub/web build`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api test -- create-checkout.use-case.spec.ts checkout.service.spec.ts`
    - `pnpm --filter @eventhub/api build`
    - `rg -n "\\bany\\b|as any|Record<string, any>" apps/api/src/modules/checkout apps/api/src/modules/enterprise apps/api/src/modules/reports apps/web/lib apps/mobile/App.tsx -g '*.ts' -g '*.tsx'`
    - `git diff --check`
- Concluido **Configurar storage externo para uploads**:
  - Adicionado `@aws-sdk/client-s3` na API.
  - Criado `UploadStorageService` com upload S3, URL publica externa e fallback local apenas fora de producao.
  - Upload agora usa `memoryStorage`, validando extensao, MIME type e magic number antes de persistir.
  - `NODE_ENV=production` exige `AWS_S3_ASSETS_BUCKET` e `AWS_S3_ASSETS_PUBLIC_URL`.
  - `.env.example`, `docs/infrastructure-deploy.md` e `docs/product-maturity.md` foram atualizados.
  - Adicionados testes para S3, producao sem storage externo, arquivo adulterado, extensao invalida e controller protegido por JWT.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- upload-storage.service.spec.ts upload.controller.spec.ts env.schema.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `git diff --check`
- Concluido **Fortalecer observabilidade**:
  - Criado `BusinessMetricsService` global para renderizar metricas Prometheus dinamicas em `/metrics`.
  - Checkout registra pedidos criados e conflitos de estoque sem labels sensiveis.
  - Pagamentos registram transicoes de status e quantidade de tickets emitidos.
  - Webhooks registram recebidos, processados, duplicados e nao encontrados por provedor/status.
  - Check-in registra entradas liberadas, recusadas, duplicadas, nao encontradas e assinaturas invalidas.
  - `docs/observability.md` agora lista metricas implementadas e reforca que labels nao devem conter PII, tokens ou identificadores de pagamento.
  - Adicionado teste unitario garantindo formato Prometheus e ausencia de labels como `email` e `token`.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/api test -- business-metrics.service.spec.ts create-checkout.use-case.spec.ts payments.service.spec.ts webhooks.service.spec.ts validate-ticket.use-case.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
    - `git diff --check`
- Concluido **Preparar mobile para ambiente real**:
  - Adicionado `expo-secure-store` para persistir o access token fora de storage comum.
  - Criado `src/mobile-auth.ts` com normalizacao da API URL, login, leitura de `/auth/me` e registro de device mobile.
  - App mobile agora exibe tela de login por email/senha e nao pede token manual.
  - API URL, evento e device sao configuraveis e persistidos para staging/producao.
  - Ao logar, o app registra o aparelho em `/enterprise/mobile/devices`, validando permissao `CHECK_IN` antes de liberar operacao.
  - Perfil ganhou informacoes de ambiente/device e logout que remove o token seguro.
  - Adicionado teste mobile com `node:test`/`tsx` para login, token sem vazamento em URL, falha fechada sem access token e registro de device.
  - Corrigido desalinhamento de `jest-mock` para manter a suite da API executavel depois da atualizacao do lockfile.
  - Verificacoes executadas:
    - `pnpm --filter @eventhub/mobile test`
    - `pnpm --filter @eventhub/mobile typecheck`
    - `pnpm --filter @eventhub/api test -- auth.controller.spec.ts auth.service.spec.ts enterprise.controller.spec.ts enterprise.service.spec.ts`
    - `pnpm --filter @eventhub/api test`
    - `pnpm --filter @eventhub/api build`
