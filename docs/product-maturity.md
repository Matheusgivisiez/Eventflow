# Event Flow Product Maturity

Esta matriz separa o que está pronto para uso, o que existe de forma parcial e o que ainda é planejamento técnico. Ela deve ser usada junto com o checklist de correção antes de qualquer venda, demo ou deploy real.

## Legenda

- `production_ready`: fluxo implementado, protegido por testes relevantes e com contrato utilizável no produto.
- `partial`: modelo, tela ou endpoint existe, mas ainda depende de integração externa, refinamento de segurança, DTOs, operação ou testes maiores.
- `prototype`: ideia navegável ou blueprint técnico, sem garantia operacional.
- `not_started`: ainda não implementado no repositório.

## Pronto Para Uso Local/Staging

| Area | Status | Evidência | Observação |
| --- | --- | --- | --- |
| Autenticação | `production_ready` | JWT, refresh token em cookie HttpOnly, logout, recuperação de senha por SMTP | Requer secrets fortes e SMTP em produção. |
| Eventos e lotes | `production_ready` | CRUD, página pública, ticket types, SEO básico | Ainda precisa validação de carga antes de venda em alto volume. |
| Checkout | `production_ready` | Reserva atômica de estoque, pedido, URL de sucesso protegida por token | Gateway externo precisa credenciais reais. |
| Pagamentos internos | `production_ready` | Webhook idempotente, status, tickets e ledger | Confirmação confiável depende de webhook assinado pelo provedor. |
| QR Code e check-in | `production_ready` | QR assinado, check-in válido, duplicado e adulterado testados | Operação real deve testar dispositivos no local. |
| Permissões enterprise | `production_ready` | Roles, TeamPermissionGuard e testes negativos | Cobertura atual protege rotas administrativas enterprise. |

## Parcial

| Area | Status | Evidência | Falta Para Produção |
| --- | --- | --- | --- |
| Dashboard financeiro | `partial` | KPIs, saldos, extratos e saques | Conciliação real, antifraude financeiro e auditoria operacional. |
| White-label | `partial` | Configuração de domínio, tema, remetente e upload S3 para assets | Validação automática de domínio e provisionamento CDN/DNS completo. |
| Mobile check-in offline | `production_ready` | Expo app, login real, API configurável, token em SecureStore, SQLite local, registro de device e sync enterprise | Operação real deve testar dispositivos no local e credenciais/permissões em staging. |
| Afiliados | `partial` | Programa, links, comissões e payouts no modelo/API | Regras de pagamento, painel completo e antifraude. |
| CRM e marketing | `partial` | Clientes, segmentos, campanhas, automações e mensagens | Provedores reais de email/WhatsApp/push/SMS e consentimento operacional. |
| Analytics | `partial` | Eventos internos, funis, heatmaps e integrações modeladas | Coleta consistente no frontend, dashboards e validação de privacidade. |
| API pública | `partial` | API clients, API keys, docs e SDK inicial | Guard de API key, OAuth token exchange e versionamento público. |
| Seat maps | `partial` | Mapas, assentos, holds e reservas | Editor visual completo e lock distribuído exercitado em carga. |
| Marketplace | `partial` | Busca, categorias, favoritos, reviews e perfil | Workflow de verificação de organizador e moderação. |
| Security enterprise | `partial` | 2FA, backups, policies e encryption key records | Fluxo real de 2FA, restore testado e rotação de chaves. |
| Observabilidade | `partial` | `/api/metrics`, métricas de negócio para checkout/pagamento/webhook/check-in, Prometheus/Grafana/Loki na infra | Alertas práticos, dashboards finais e runbooks exercitados. |

## Planejado/Prototype

| Area | Status | Evidência | Próximo Passo |
| --- | --- | --- | --- |
| IA enterprise | `prototype` | Forecasts, insights e sinais modelados | Definir motor/modelo, dados de treino, explicabilidade e limites de uso. |
| Infraestrutura multi-região | `prototype` | Docker, K8s manifests e blueprint AWS | Testar deploy real, autoscaling, secrets, CDN, storage e DR. |
| SDK público completo | `prototype` | Pacote `packages/sdk` inicial | Gerar SDK a partir do OpenAPI e cobrir auth/erros/paginação. |

## Gates Antes de Produzir

- Aplicar migrations em banco semelhante a produção.
- Rodar API/web/mobile typecheck, testes e builds em CI.
- Validar webhook de pagamento com assinatura real do provedor.
- Configurar SMTP, S3 de assets, CDN/public URL e secrets fortes.
- Testar backup e restore.
- Executar teste de carga para checkout, página pública e check-in.
- Revisar LGPD, termos, consentimentos e política de retenção.
