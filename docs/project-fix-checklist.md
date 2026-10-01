# Event Flow - Checklist de Correção e Evolução

Atualizado em: 2026-08-15

Este arquivo e o quadro de acompanhamento do projeto. Use os status abaixo para acompanhar a evolução:

- `[ ]` Pendente
- `[~]` Em andamento
- `[x]` Concluído
- `[!]` Bloqueado

## Regra Obrigatória de Qualidade

Nenhum item pode ser marcado como `[x]` sem:

- Testes automatizados cobrindo a correção feita.
- Teste negativo quando o item envolver segurança, permissão ou vazamento de dados.
- Verificação de que rotas/serviços relacionados continuam funcionando.
- `git diff --check` sem erros.
- Build do pacote afetado quando houver mudança de tipo, rota, schema ou frontend.

Se algum teste não puder ser executado, o item deve ficar `[~]` ou `[!]` com o motivo registrado no log.

## Ordem de Prioridade

### P0 - Corrigir Antes de Produzir ou Vender de Verdade

- [x] **Evitar oversell no checkout**
  - Problema: o estoque é validado ao criar o pedido, mas `sold` só aumenta quando o pagamento vira `PAID`. Compras simultâneas podem vender mais ingressos do que a quantidade disponível.
  - Evidência: `apps/api/src/modules/checkout/use-cases/create-checkout.use-case.ts`, `apps/api/src/modules/payments/payments.service.ts`.
  - Como corrigir: reservar estoque de forma atômica no checkout ou incrementar estoque com `UPDATE ... WHERE quantity - sold >= qty` dentro da transação.
  - Critério de aceite: dois checkouts concorrentes para o último ingresso não podem ambos concluir reserva/pedido válido.
  - Resultado: criado `Order.stockReservedAt`, reserva atômica no checkout e liberação de estoque quando pagamento/pedido é cancelado.

- [x] **Proteger consulta pública de pedido**
  - Problema: `GET /checkout/order/:orderId` retorna nome, e-mail, tickets e QR Code apenas com o ID do pedido.
  - Evidência: `apps/api/src/modules/checkout/checkout.service.ts`.
  - Como corrigir: criar `orderAccessToken` aleatório, exigir token na consulta, ou validar e-mail/documento junto com o pedido.
  - Critério de aceite: não é possível consultar QR Code ou dados pessoais somente com `orderId`.
  - Resultado: criado `Order.orderAccessToken`, retorno do provedor inclui `accessToken` na URL de sucesso, e `GET /checkout/order/:orderId` exige token válido.

- [x] **Restringir alteração manual de status de pagamento**
  - Problema: rota autenticada permite alterar status de pagamento; isso pode permitir marcar pedido como pago fora do fluxo de webhook.
  - Evidência: `apps/api/src/modules/payments/payments.controller.ts`.
  - Como corrigir: limitar a `ADMIN` interno ou permissão financeira explicita; idealmente pagamento confirmado apenas por webhook verificado.
  - Critério de aceite: organizador comum/equipe sem permissão não consegue marcar pagamento como `PAID`.
  - Resultado: rota manual `PATCH /payments/:id/status` agora exige role `ADMIN`; rota de criar preferência de pagamento valida tenant para chamadas autenticadas.

- [x] **Mover refresh token para cookie HttpOnly**
  - Problema: access token e refresh token ficam persistidos no storage do navegador.
  - Evidência: `apps/web/stores/auth-store.ts`.
  - Como corrigir: refresh token em cookie `HttpOnly`, `Secure`, `SameSite`; access token em memória ou renovação via endpoint.
  - Critério de aceite: `localStorage` não contém refresh token.
  - Resultado: refresh token agora e entregue somente em cookie `eventflow_refresh` HttpOnly; respostas de login/registro/refresh não retornam `refreshToken`; web usa `credentials: "include"` e não persiste refresh token.

- [x] **Remover secrets default fracos em produção**
  - Problema: `env.schema.ts` aceita secrets default `change-me-*`.
  - Evidência: `apps/api/src/config/env.schema.ts`, `.env.example`.
  - Como corrigir: exigir secrets fortes quando `NODE_ENV=production`; manter defaults apenas para desenvolvimento local.
  - Critério de aceite: API falha ao subir em produção sem secrets reais.
  - Resultado: `envSchema` rejeita produção sem JWT/QR secrets fortes; defaults agora são explicitamente `dev-only`; fallbacks fracos de QR foram removidos dos serviços.

### P1 - Fluxos Críticos e Confiabilidade

- [x] **Adicionar testes de checkout concorrente**
  - Problema: não há teste cobrindo corrida de estoque.
  - Como corrigir: teste de integração simulando duas compras simultâneas no mesmo lote.
  - Critério de aceite: teste falha no comportamento atual e passa após correção de reserva/estoque.
  - Resultado: adicionado teste do `CreateCheckoutUseCase` simulando duas leituras concorrentes para o último ingresso; apenas uma reserva atômica cria pedido.

- [x] **Adicionar testes de webhook pago**
  - Problema: fluxo de pagamento aprovado precisa garantir idempotência, emissão de tickets e ledger.
  - Como corrigir: testar webhook duplicado, transição `PENDING -> PAID`, criação de tickets e entrada financeira.
  - Critério de aceite: webhook duplicado não cria tickets nem ledger duplicados.
  - Resultado: adicionados testes para webhook pago, duplicado, pagamento já pago, pagamento não encontrado, emissão idempotente de tickets e ledger financeiro único.

- [x] **Adicionar testes de check-in duplicado e QR adulterado**
  - Problema: check-in e QR Code são fluxo sensível de entrada no evento.
  - Como corrigir: testar ingresso válido, usado, cancelado e assinatura inválida.
  - Critério de aceite: QR adulterado é recusado; ingresso usado gera status duplicado.
  - Resultado: adicionados testes para QR válido, QR adulterado, ingresso duplicado, ingresso cancelado, ticket fora do tenant/evento e ausência de `QR_CODE_SECRET`.

- [x] **Corrigir recuperação de senha para envio real**
  - Problema: `forgotPassword` cria token, mas ainda há TODO para envio por email/SMS.
  - Evidência: `apps/api/src/modules/auth/auth.service.ts`.
  - Como corrigir: integrar provedor de email, template e fluxo de reset sem vazar token em logs/resposta.
  - Critério de aceite: usuário recebe link seguro de reset e token não aparece na resposta da API.
  - Resultado: `forgotPassword` agora envia link por SMTP via `MailService`, não retorna token, produção exige configuração SMTP e web tem página `/reset-password`.

- [x] **Aplicar permissões nas rotas enterprise**
  - Problema: várias rotas enterprise usam apenas `JwtAuthGuard`, sem role/permissão especifica.
  - Evidência: `apps/api/src/modules/enterprise/enterprise.controller.ts`.
  - Como corrigir: aplicar `RolesGuard`, `TeamPermissionGuard` e decorators por área.
  - Critério de aceite: equipe sem permissão não acessa CRM, financeiro, white-label, API keys ou segurança.
  - Resultado: rotas enterprise privadas agora exigem role enterprise e permissão por area; rotas de marketplace para cliente autenticado mantém acesso específico.

### P2 - Produto, Manutenção e Clareza

- [x] **Separar `EnterpriseService` por domínio**
  - Problema: arquivo concentra muitas responsabilidades em um serviço grande.
  - Evidência: `apps/api/src/modules/enterprise/enterprise.service.ts`.
  - Como corrigir: dividir em serviços menores: white-label, CRM, marketing, analytics, seat maps, marketplace, AI, security.
  - Critério de aceite: cada serviço tem responsabilidade única e testes próprios.
  - Resultado: `EnterpriseService` virou fachada de 187 linhas e a lógica foi separada em 13 serviços por domínio com teste de delegação.

- [x] **Trocar readiness fake por status real**
  - Problema: `overview` retorna todos os módulos como prontos, mesmo quando são parciais/protótipos.
  - Evidência: `apps/api/src/modules/enterprise/services/enterprise-overview.service.ts`.
  - Como corrigir: usar status `not_started`, `prototype`, `partial`, `production_ready` com checks objetivos.
  - Critério de aceite: dashboard enterprise reflete maturidade real dos módulos.
  - Resultado: `overview.readiness` agora usa status graduado com evidência objetiva por módulo; web exibe o status e a evidência.

- [x] **Padronizar marca Event Flow**
  - Problema: README/docs usavam Event Flow, enquanto partes do web/mobile usavam outra marca.
  - Evidência: `README.md`, `apps/mobile/App.tsx`, `apps/mobile/src/offline-checkin.ts`.
  - Como corrigir: escolher nome oficial e ajustar textos, storage keys, app name e documentação.
  - Critério de aceite: uma única marca aparece em web, API, mobile, docs e seed.
  - Resultado: Event Flow foi definido como marca oficial; textos visíveis, metadata, docs, downloads e storage keys foram alinhados.

- [x] **Revisar documentação para separar pronto, parcial e planejado**
  - Problema: README e docs prometem funcionalidades enterprise que ainda não estão completas.
  - Como corrigir: criar matriz de maturidade por módulo e ajustar promessas.
  - Critério de aceite: qualquer pessoa entende o que pode ser usado hoje e o que é roadmap.
  - Resultado: criada matriz `docs/product-maturity.md`; README, índice técnico e enterprise platform agora apontam pronto/parcial/protótipo.

- [x] **Reduzir uso de `any` em áreas críticas**
  - Problema: `any` reduz confiabilidade de contratos em checkout, reports, enterprise, web e mobile.
  - Como corrigir: criar tipos/DTOs para payloads, responses e entidades derivadas.
  - Critério de aceite: fluxos críticos sem `any` evitável.
  - Resultado: checkout, reports, mobile e helper web foram tipados; enterprise manteve apenas wrapper Prisma dinâmico isolado por compatibilidade.

### P3 - Infraestrutura e Operação

- [x] **Configurar storage externo para uploads**
  - Problema: upload local em disco não escala bem e pode perder arquivos em deploy.
  - Evidência: `apps/api/src/modules/upload/upload.controller.ts`.
  - Como corrigir: S3/CloudFront ou storage equivalente, mantendo validação de tipo e tamanho.
  - Critério de aceite: upload retorna URL persistente externa e funciona em ambiente stateless.
  - Resultado: upload usa `memoryStorage`, valida tipo/assinatura antes de persistir e envia assets para S3 quando configurado; produção exige S3/public URL.

- [x] **Fortalecer observabilidade**
  - Problema: Prometheus/Grafana existem na infra, mas faltam métricas de negócio e alertas práticos.
  - Como corrigir: métricas para checkout, webhook, pagamento, check-in, fila e erros.
  - Critério de aceite: dashboard mostra saúde dos fluxos críticos e alertas acionáveis.
  - Resultado: `/metrics` agora usa `BusinessMetricsService`; checkout, pagamento, webhook e check-in registram contadores de negócio sem labels com PII/secrets; documentação lista métricas implementadas e próximos sinais recomendados.

- [x] **Preparar mobile para ambiente real**
  - Problema: app mobile usa API fixa local e token manual.
  - Evidência: `apps/mobile/App.tsx`.
  - Como corrigir: tela de login, ambiente configurável e armazenamento seguro do token.
  - Critério de aceite: operador consegue logar e sincronizar em staging/produção sem colar token manualmente.
  - Resultado: app mobile agora tem login por email/senha, API URL configurável, token salvo em `expo-secure-store`, recuperação de sessão, logout, persistência de evento/device e registro de device com validação da permissão `CHECK_IN`.

## Progresso

- Total de itens: 18
- Concluídos: 18
- Em andamento: 0
- Bloqueados: 0

## Registro de Execução

### 2026-08-15

- Criado checklist inicial após análise completa do projeto.
- Primeira recomendação de execução: começar por **Evitar oversell no checkout**, porque afeta dinheiro, estoque e confiança do produto.
- Concluído **Evitar oversell no checkout**:
  - Adicionado campo `stockReservedAt` em `Order`.
  - Adicionada migração `20260815120000_order_stock_reservation`.
  - Checkout agora reserva estoque com atualização condicional atômica.
  - Pagamento aprovado não incrementa estoque novamente quando o pedido já tinha reserva.
  - Cancelamento/reembolso libera estoque reservado.
  - Falha ao criar checkout no provedor externo cancela o pedido e libera a reserva.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `git diff --check`
- Concluído **Proteger consulta pública de pedido**:
  - Adicionado campo `orderAccessToken` em `Order`.
  - Consulta pública do pedido agora exige `accessToken`.
  - URL de retorno/sucesso do provedor inclui `orderId` e `accessToken`.
  - Página `/checkout/success` so consulta pedido quando os dois parâmetros existem.
  - Adicionados testes unitários para token ausente, token inválido, token válido, retorno do token no checkout e URLs do provedor.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- checkout.service.spec.ts payments.service.spec.ts transfers.service.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `pnpm --filter @eventflow/web build`
    - `git diff --check`
- Concluído **Restringir alteração manual de status de pagamento**:
  - `PaymentsController` agora usa `JwtAuthGuard` e `RolesGuard`.
  - `PATCH /payments/:id/status` exige `ADMIN`.
  - `POST /payments/orders/:orderId/preference` exige `ADMIN` ou `ORGANIZER`.
  - Criação autenticada de preferência de pagamento valida o tenant do pedido.
  - Adicionados testes para roles do controller, bloqueio por tenant errado e criação por tenant correto.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- payments.controller.spec.ts payments.service.spec.ts checkout.service.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `git diff --check`
- Concluído **Mover refresh token para cookie HttpOnly**:
  - Auth API agora seta cookie `eventflow_refresh` HttpOnly em login, registro, registro de organizador, refresh e upgrade para organizador.
  - `POST /auth/refresh` aceita refresh pelo cookie HttpOnly.
  - `POST /auth/logout` limpa cookie e revoga refresh token no banco.
  - Web não espera nem persiste `refreshToken`; chamadas usam `credentials: "include"`.
  - Adicionados testes para cookie HttpOnly, ausência de `refreshToken` na resposta, refresh via cookie, logout com limpeza de cookie e revogação por hash.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- auth.controller.spec.ts auth.service.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `pnpm --filter @eventflow/web build`
    - `rg -n "refreshToken" apps/web`
    - `git diff --check`
- Concluído **Remover secrets default fracos em produção**:
  - `envSchema` agora exige `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_RESET_SECRET` e `QR_CODE_SECRET` fortes em `NODE_ENV=production`.
  - Defaults de desenvolvimento foram renomeados para `dev-only-*`.
  - `.env.example` foi atualizado para deixar claro que os valores são apenas locais.
  - Removidos fallbacks `change-me-*` de assinatura/validação de QR Code nos serviços de pagamento, check-in e transferência.
  - Adicionados testes para defaults de desenvolvimento, produção sem secrets, produção com secrets fracos e produção com secrets fortes.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- env.schema.spec.ts payments.service.spec.ts transfers.service.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `rg -n "change-me" apps/api/src .env.example`
    - `git diff --check`
- Concluído **Adicionar testes de checkout concorrente**:
  - Adicionado `create-checkout.use-case.spec.ts`.
  - Teste simula duas tentativas para o último ingresso com leitura de estoque obsoleta e reserva atômica condicional.
  - Verifica que apenas um pedido é criado, estoque reservado fica em 1, `stockReservedAt` e `orderAccessToken` são preenchidos, e a segunda tentativa falha.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- create-checkout.use-case.spec.ts checkout.service.spec.ts payments.service.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `git diff --check`
- Concluído **Adicionar testes de webhook pago**:
  - Adicionado `webhooks.service.spec.ts` cobrindo pagamento pago via AbacatePay, log processado, auditoria e notificação do comprador.
  - Adicionados testes de duplicidade para garantir que webhook já processado não chama pagamento nem notificação.
  - Ampliado `payments.service.spec.ts` para cobrir `PENDING -> PAID`, emissão de tickets, ledger único, retry idempotente e ordem legada sem reserva de estoque.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- webhooks.service.spec.ts payments.service.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `git diff --check`
- Concluído **Adicionar testes de check-in duplicado e QR adulterado**:
  - Adicionado `validate-ticket.use-case.spec.ts`.
  - Testes cobrem entrada liberada, QR adulterado recusado antes de consultar ticket, duplicidade com log, ticket cancelado com log, ticket não encontrado no tenant/evento e falha fechada sem `QR_CODE_SECRET`.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- validate-ticket.use-case.spec.ts payments.service.spec.ts transfers.service.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `git diff --check`
- Concluído **Corrigir recuperação de senha para envio real**:
  - Adicionado `MailService` com envio SMTP por Nodemailer e fallback seguro de desenvolvimento quando SMTP não está configurado.
  - `forgotPassword` agora cria token com hash, envia link de reset e mantém resposta genérica sem expor token.
  - `envSchema` exige `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` em produção.
  - `.env.example` documenta as variáveis SMTP.
  - Criada página web `/reset-password` para consumir o token recebido por email.
  - Adicionados testes para envio SMTP, fallback sem SMTP, não vazamento do token, usuário inexistente e validação de SMTP em produção.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- auth.service.spec.ts mail.service.spec.ts env.schema.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `pnpm --filter @eventflow/web build`
    - `git diff --check`
- Concluído **Aplicar permissões nas rotas enterprise**:
  - Criados decorators locais para padronizar guards enterprise no controller.
  - Rotas privadas enterprise agora exigem `JwtAuthGuard`, `RolesGuard`, `TeamPermissionGuard`, role `ADMIN`/`ORGANIZER`/`TEAM` e permissão especifica por area.
  - White-label, CRM, marketing, afiliados, analytics, API pública, seat maps, segurança, mobile check-in e infraestrutura receberam permissões dedicadas.
  - Reviews e favoritos do marketplace continuam disponíveis para usuários autenticados, sem abrir as rotas administrativas enterprise.
  - Adicionados testes de metadados e testes negativos reais dos guards para cliente comum e membro de equipe sem permissão.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- enterprise.controller.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `git diff --check`
- Concluído **Separar `EnterpriseService` por domínio**:
  - Criado `EnterpriseDomainService` com helpers compartilhados de tenant, strings, hash, slug e validação de evento.
  - Extraídos serviços por domínio: overview, white-label, mobile, afiliados, CRM, marketing, analytics, API pública, seat maps, marketplace, AI/executive, security e infrastructure.
  - `EnterpriseService` agora é uma fachada fina que preserva o contrato usado pelo controller.
  - `EnterpriseModule` registra todos os providers de domínio.
  - Adicionado `enterprise.service.spec.ts` cobrindo a delegação de todos os métodos públicos para o domínio correto.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- enterprise.controller.spec.ts enterprise.service.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `git diff --check`
- Concluído **Trocar readiness fake por status real**:
  - `EnterpriseOverviewService` deixou de retornar booleanos sempre verdadeiros.
  - Readiness agora usa `not_started`, `prototype`, `partial` e `production_ready`.
  - Status e evidências são calculados com dados reais do tenant: white-label, mobile, afiliados, CRM, marketing, analytics, API pública, seat maps, marketplace, IA, segurança e infraestrutura.
  - Página web `/enterprise` foi atualizada para exibir status e evidência por módulo.
  - Adicionado `enterprise-overview.service.spec.ts` cobrindo tenant sem dados e tenant com setup completo.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- enterprise-overview.service.spec.ts enterprise.service.spec.ts enterprise.controller.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `pnpm --filter @eventflow/web build`
    - `git diff --check`
- Concluído **Padronizar marca Event Flow**:
  - Event Flow foi definido como marca oficial do produto.
  - Web atualizado em metadata, rodapés, política de cookies, logo acessível, texto do logo e nomes de download.
  - Mobile atualizado em textos visíveis, fallback de device ID e avatar.
  - API/docs/testes alinhados em textos financeiros, AbacatePay e dados de teste.
  - Mantidos identificadores técnicos `@eventflow/*`, cookies, métricas, containers e namespaces por compatibilidade.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- transfers.service.spec.ts`
    - `pnpm --filter @eventflow/mobile typecheck`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `pnpm --filter @eventflow/web build`
    - busca por nomes antigos da marca em `apps`, `docs`, `README.md`, `package.json` e `test-abacatepay.mjs`
    - `git diff --check`
- Concluído **Revisar documentação para separar pronto, parcial e planejado**:
  - Criada `docs/product-maturity.md` com legenda `production_ready`, `partial`, `prototype` e `not_started`.
  - README ganhou resumo de maturidade e link direto para a matriz.
  - `docs/index.md` passou a tratar a matriz como fonte canônica de maturidade.
  - `docs/enterprise-platform.md` foi reescrito como inventário com status e lacunas, não como promessa de prontidão.
  - Verificações executadas:
    - `rg -n "product-maturity|Product Maturity|Maturidade do produto|production_ready|partial|prototype|not_started" README.md docs/index.md docs/enterprise-platform.md docs/product-maturity.md docs/project-fix-checklist.md`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/web build`
    - `git diff --check`
- Concluído **Reduzir uso de `any` em áreas críticas**:
  - `CreateCheckoutUseCase` agora usa `Prisma.TransactionClient` e `Prisma.EventGetPayload` nos helpers transacionais.
  - `ReportsService` ganhou tipos para participantes e linhas de exportação.
  - `ReportsProcessor` ganhou tipos de job/result e tratamento de erro sem `any`.
  - `apps/web/lib/api.ts` ganhou `ApiError` tipado com `status`.
  - `apps/mobile/App.tsx` ganhou props tipadas para `CheckInTab` e `SyncTab`.
  - `AnyRecord` enterprise passou a representar payloads como `Record<string, unknown>`; o acesso Prisma dinâmico ficou isolado em `DynamicPrismaClient`.
  - Verificações executadas:
    - `pnpm --filter @eventflow/mobile typecheck`
    - `pnpm --filter @eventflow/web build`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api test -- create-checkout.use-case.spec.ts checkout.service.spec.ts`
    - `pnpm --filter @eventflow/api build`
    - `rg -n "\\bany\\b|as any|Record<string, any>" apps/api/src/modules/checkout apps/api/src/modules/enterprise apps/api/src/modules/reports apps/web/lib apps/mobile/App.tsx -g '*.ts' -g '*.tsx'`
    - `git diff --check`
- Concluído **Configurar storage externo para uploads**:
  - Adicionado `@aws-sdk/client-s3` na API.
  - Criado `UploadStorageService` com upload S3, URL pública externa e fallback local apenas fora de produção.
  - Upload agora usa `memoryStorage`, validando extensão, MIME type e magic number antes de persistir.
  - `NODE_ENV=production` exige `AWS_S3_ASSETS_BUCKET` e `AWS_S3_ASSETS_PUBLIC_URL`.
  - `.env.example`, `docs/infrastructure-deploy.md` e `docs/product-maturity.md` foram atualizados.
  - Adicionados testes para S3, produção sem storage externo, arquivo adulterado, extensão inválida e controller protegido por JWT.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- upload-storage.service.spec.ts upload.controller.spec.ts env.schema.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `git diff --check`
- Concluído **Fortalecer observabilidade**:
  - Criado `BusinessMetricsService` global para renderizar métricas Prometheus dinâmicas em `/metrics`.
  - Checkout registra pedidos criados e conflitos de estoque sem labels sensíveis.
  - Pagamentos registram transições de status e quantidade de tickets emitidos.
  - Webhooks registram recebidos, processados, duplicados e não encontrados por provedor/status.
  - Check-in registra entradas liberadas, recusadas, duplicadas, não encontradas e assinaturas inválidas.
  - `docs/observability.md` agora lista métricas implementadas e reforça que labels não devem conter PII, tokens ou identificadores de pagamento.
  - Adicionado teste unitário garantindo formato Prometheus e ausência de labels como `email` e `token`.
  - Verificações executadas:
    - `pnpm --filter @eventflow/api test -- business-metrics.service.spec.ts create-checkout.use-case.spec.ts payments.service.spec.ts webhooks.service.spec.ts validate-ticket.use-case.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
    - `git diff --check`
- Concluído **Preparar mobile para ambiente real**:
  - Adicionado `expo-secure-store` para persistir o access token fora de storage comum.
  - Criado `src/mobile-auth.ts` com normalização da API URL, login, leitura de `/auth/me` e registro de device mobile.
  - App mobile agora exibe tela de login por email/senha e não pede token manual.
  - API URL, evento e device são configuráveis e persistidos para staging/produção.
  - Ao logar, o app registra o aparelho em `/enterprise/mobile/devices`, validando permissão `CHECK_IN` antes de liberar operação.
  - Perfil ganhou informações de ambiente/device e logout que remove o token seguro.
  - Adicionado teste mobile com `node:test`/`tsx` para login, token sem vazamento em URL, falha fechada sem access token e registro de device.
  - Corrigido desalinhamento de `jest-mock` para manter a suite da API executável depois da atualização do lockfile.
  - Verificações executadas:
    - `pnpm --filter @eventflow/mobile test`
    - `pnpm --filter @eventflow/mobile typecheck`
    - `pnpm --filter @eventflow/api test -- auth.controller.spec.ts auth.service.spec.ts enterprise.controller.spec.ts enterprise.service.spec.ts`
    - `pnpm --filter @eventflow/api test`
    - `pnpm --filter @eventflow/api build`
