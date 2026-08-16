# Event Flow Product Maturity

Esta matriz separa o que esta pronto para uso, o que existe de forma parcial e o que ainda e planejamento tecnico. Ela deve ser usada junto com o checklist de correcao antes de qualquer venda, demo ou deploy real.

## Legenda

- `production_ready`: fluxo implementado, protegido por testes relevantes e com contrato utilizavel no produto.
- `partial`: modelo, tela ou endpoint existe, mas ainda depende de integracao externa, refinamento de seguranca, DTOs, operacao ou testes maiores.
- `prototype`: ideia navegavel ou blueprint tecnico, sem garantia operacional.
- `not_started`: ainda nao implementado no repositorio.

## Pronto Para Uso Local/Staging

| Area | Status | Evidencia | Observacao |
| --- | --- | --- | --- |
| Autenticacao | `production_ready` | JWT, refresh token em cookie HttpOnly, logout, recuperacao de senha por SMTP | Requer secrets fortes e SMTP em producao. |
| Eventos e lotes | `production_ready` | CRUD, pagina publica, ticket types, SEO basico | Ainda precisa validacao de carga antes de venda em alto volume. |
| Checkout | `production_ready` | Reserva atomica de estoque, pedido, URL de sucesso protegida por token | Gateway externo precisa credenciais reais. |
| Pagamentos internos | `production_ready` | Webhook idempotente, status, tickets e ledger | Confirmacao confiavel depende de webhook assinado pelo provedor. |
| QR Code e check-in | `production_ready` | QR assinado, check-in valido, duplicado e adulterado testados | Operacao real deve testar dispositivos no local. |
| Permissoes enterprise | `production_ready` | Roles, TeamPermissionGuard e testes negativos | Cobertura atual protege rotas administrativas enterprise. |

## Parcial

| Area | Status | Evidencia | Falta Para Producao |
| --- | --- | --- | --- |
| Dashboard financeiro | `partial` | KPIs, saldos, extratos e saques | Conciliacao real, antifraude financeiro e auditoria operacional. |
| White-label | `partial` | Configuracao de dominio, tema, remetente e upload S3 para assets | Validacao automatica de dominio e provisionamento CDN/DNS completo. |
| Mobile check-in offline | `production_ready` | Expo app, login real, API configuravel, token em SecureStore, SQLite local, registro de device e sync enterprise | Operacao real deve testar dispositivos no local e credenciais/permissoes em staging. |
| Afiliados | `partial` | Programa, links, comissoes e payouts no modelo/API | Regras de pagamento, painel completo e antifraude. |
| CRM e marketing | `partial` | Clientes, segmentos, campanhas, automacoes e mensagens | Provedores reais de email/WhatsApp/push/SMS e consentimento operacional. |
| Analytics | `partial` | Eventos internos, funis, heatmaps e integracoes modeladas | Coleta consistente no frontend, dashboards e validacao de privacidade. |
| API publica | `partial` | API clients, API keys, docs e SDK inicial | Guard de API key, OAuth token exchange e versionamento publico. |
| Seat maps | `partial` | Mapas, assentos, holds e reservas | Editor visual completo e lock distribuido exercitado em carga. |
| Marketplace | `partial` | Busca, categorias, favoritos, reviews e perfil | Workflow de verificacao de organizador e moderacao. |
| Security enterprise | `partial` | 2FA, backups, policies e encryption key records | Fluxo real de 2FA, restore testado e rotacao de chaves. |
| Observabilidade | `partial` | `/api/metrics`, metricas de negocio para checkout/pagamento/webhook/check-in, Prometheus/Grafana/Loki na infra | Alertas praticos, dashboards finais e runbooks exercitados. |

## Planejado/Prototype

| Area | Status | Evidencia | Proximo Passo |
| --- | --- | --- | --- |
| IA enterprise | `prototype` | Forecasts, insights e sinais modelados | Definir motor/modelo, dados de treino, explicabilidade e limites de uso. |
| Infraestrutura multi-regiao | `prototype` | Docker, K8s manifests e blueprint AWS | Testar deploy real, autoscaling, secrets, CDN, storage e DR. |
| SDK publico completo | `prototype` | Pacote `packages/sdk` inicial | Gerar SDK a partir do OpenAPI e cobrir auth/erros/paginacao. |

## Gates Antes de Produzir

- Aplicar migrations em banco semelhante a producao.
- Rodar API/web/mobile typecheck, testes e builds em CI.
- Validar webhook de pagamento com assinatura real do provedor.
- Configurar SMTP, S3 de assets, CDN/public URL e secrets fortes.
- Testar backup e restore.
- Executar teste de carga para checkout, pagina publica e check-in.
- Revisar LGPD, termos, consentimentos e politica de retencao.
