# Event Flow - Plano de Operação

Atualizado em: 2026-08-16

Este documento define como operar o Event Flow em staging e produção depois do fechamento técnico do hardening. Use junto com `docs/staging-readiness.md`, `docs/project-fix-checklist.md` e `docs/product-maturity.md`.

## Objetivos

- Subir staging de forma controlada.
- Validar fluxos críticos antes de produção.
- Reduzir risco de perda financeira, vazamento de dados e indisponibilidade.
- Padronizar deploy, rollback, monitoramento, incidentes e rotinas recorrentes.
- Impedir que código sem teste/build passe para deploy.

## Ordem Para Começar

Execute o projeto nesta ordem. Não avance para produção sem concluir staging com evidência registrada.

1. Fechar documentação operacional: `docs/operations-plan.md`, `docs/staging-readiness.md` e runbooks essenciais.
2. Confirmar que o repositório está limpo e que a branch atual está sincronizada com o remote.
3. Rodar os gates locais obrigatórios de teste, build e whitespace.
4. Revisar variáveis obrigatórias e gerar secrets fortes para staging.
5. Provisionar staging: PostgreSQL, Redis, RabbitMQ, S3/CDN, SMTP, AbacatePay sandbox e monitoramento.
6. Aplicar migrations em staging e subir API.
7. Subir web e configurar mobile apontando para a API de staging.
8. Rodar smoke tests: `/health`, `/metrics`, login e página pública.
9. Executar checklist manual completo de staging: auth, checkout, pagamento/webhook, QR/check-in, upload e mobile.
10. Exercitar backup e restore em ambiente separado.
11. Ativar alertas mínimos e confirmar que disparam em cenários controlados.
12. Rodar teste de carga básico para página pública, checkout e check-in.
13. Registrar evidências, falhas e decisões em documento de release.
14. Preparar produção somente depois de staging aprovado ponta a ponta.

## Ambientes

### Local

Uso:

- Desenvolvimento.
- Testes automatizados.
- Validação rápida de fluxos sem serviços externos reais.

Regras:

- Pode usar secrets `dev-only-*`.
- Pode usar upload local como fallback.
- Não deve usar credenciais reais de pagamento.
- Não deve conter dados reais de cliente.

### Staging

Uso:

- Ensaiar operação real.
- Testar pagamento sandbox.
- Validar SMTP, S3/CDN, migrations, mobile e webhooks.
- Fazer homologação antes de produção.

Regras:

- `NODE_ENV=production`.
- Secrets fortes obrigatórios.
- Banco separado de produção.
- Gateway em sandbox.
- Dados fictícios ou anonimizados.
- Deploy so pode acontecer com testes e builds passando.

### Produção

Uso:

- Venda real.
- Check-in real.
- Dados reais de usuários, compradores e organizadores.

Regras:

- Deploy somente depois de staging aprovado.
- Migrations devem ser revisadas antes de aplicar.
- Rollback deve estar definido antes do deploy.
- Backups e restore devem estar testados.
- Logs não podem conter secrets, tokens, documentos ou payloads sensíveis.

## Serviços Obrigatórios

| Serviço | Ambiente | Uso | Obrigatório antes de produção |
| --- | --- | --- | --- |
| PostgreSQL | staging/produção | Banco principal | Sim |
| Redis | staging/produção | Cache, rate limit, filas | Sim |
| RabbitMQ | staging/produção | Jobs e processamento async | Sim |
| S3 ou compatível | staging/produção | Uploads/assets | Sim |
| CDN/public URL | staging/produção | Entrega pública de assets | Sim |
| SMTP | staging/produção | Recuperação de senha | Sim |
| AbacatePay sandbox | staging | Pagamento homologado | Sim para staging |
| AbacatePay produção | produção | Pagamento real | Sim para produção |
| Prometheus/Grafana | staging/produção | Métricas | Sim |
| Loki ou equivalente | staging/produção | Logs centralizados | Recomendado |

## Variáveis Obrigatórias

Configurar em staging e produção:

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `RABBITMQ_URL`
- `APP_URL`
- `API_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_RESET_SECRET`
- `QR_CODE_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `AWS_S3_ASSETS_BUCKET`
- `AWS_S3_ASSETS_PUBLIC_URL`
- `ABACATE_API_KEY` ou `ABACATEPAY_API_KEY`
- `ABACATE_WEBHOOK_SECRET` ou `ABACATEPAY_WEBHOOK_SECRET`
- `ABACATE_ENVIRONMENT`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Regras para secrets:

- Mínimo de 32 caracteres para JWT/QR secrets.
- Nunca usar `change-me-*` ou `dev-only-*` em staging/produção.
- Nunca commitar `.env`.
- Rotacionar secrets se forem expostos em terminal, log, print ou chat.
- Para Cloudflare R2, configurar também `AWS_S3_ENDPOINT`, `AWS_REGION=auto` e `AWS_S3_FORCE_PATH_STYLE=true`.

## Gates Obrigatórios de Deploy

Nenhum deploy pode seguir se algum item falhar:

```bash
git diff --check
pnpm --filter @eventflow/api test
pnpm --filter @eventflow/api build
pnpm --filter @eventflow/web build
pnpm --filter @eventflow/mobile test
pnpm --filter @eventflow/mobile typecheck
```

## Regra Obrigatória de Testes Por Mudança

Toda mudança de código, configuração, schema, infraestrutura ou contrato de API deve vir acompanhada de testes proporcionais ao risco. A regra vale para local, staging e produção.

Obrigatório para qualquer mudança:

- Rodar o teste focado do módulo alterado.
- Rodar build/typecheck do pacote alterado.
- Rodar `git diff --check`.
- Confirmar que nenhuma rota existente que dependa do módulo foi quebrada.
- Confirmar que nenhum secret, token, chave de API, payload sensível, documento pessoal ou QR completo foi adicionado a logs, respostas HTTP, fixtures, prints, snapshots ou docs.
- Registrar no documento de release quais testes foram executados e o resultado.

Obrigatório para mudanças em auth, permissão, checkout, pagamento, webhook, upload, ticket, QR, check-in, LGPD, logs ou variáveis de ambiente:

- Rodar a suite completa da API.
- Adicionar ou atualizar teste negativo para acesso indevido, vazamento de informação sensível ou payload adulterado.
- Validar que respostas HTTP não retornam secrets, refresh tokens, reset tokens, API keys, dados de cartão, documentos pessoais desnecessários ou QR payload completo.
- Validar que logs não imprimem secrets, tokens, credenciais, documentos pessoais ou payloads sensíveis.
- Testar pelo menos um fluxo manual em staging antes de liberar produção.

Obrigatório para mudanças que tocam rotas públicas ou frontend:

- Rodar build da web.
- Validar rota pública afetada.
- Validar estado de erro e ausência de dados sensíveis na tela.
- Confirmar que URLs com token de acesso continuam restritas ao fluxo previsto.

Obrigatório para mudanças em mobile:

- Rodar testes do mobile.
- Rodar typecheck do mobile.
- Validar login, armazenamento seguro de token, check-in online e sincronização offline quando o módulo for afetado.

Uma mudança não pode ser marcada como concluída se os testes obrigatórios não foram executados. Se algum teste não puder rodar, o item deve ficar bloqueado ou em andamento com motivo registrado.

Para mudanças que tocam banco:

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

Para mudanças de segurança, pagamento, checkout, upload, webhook ou check-in:

- Rodar suite completa da API.
- Rodar teste focado do módulo afetado.
- Testar pelo menos um fluxo manual em staging.
- Atualizar docs se o contrato mudar.

## Uso Recomendado de Modelos de IA

Use modelos mais fortes nas operações com risco financeiro, segurança, dados sensíveis, concorrência ou infraestrutura. Use modelos mais simples em tarefas mecânicas, documentação e validações repetitivas.

| Operação | Complexidade | Modelo recomendado | Motivo |
| --- | --- | --- | --- |
| Planejar staging/produção, rollback e incidentes | Alta | Modelo avançado | Exige raciocínio de risco, ordem operacional e mitigação. |
| Implementar auth, refresh token, permissões e LGPD | Alta | Modelo avançado | Alto risco de vazamento, bypass de permissão e quebra de sessão. |
| Implementar checkout, estoque concorrente, pagamento e webhook | Alta | Modelo avançado | Envolve dinheiro, idempotência, corrida e consistência de banco. |
| Revisar migrations, backup e restore | Alta | Modelo avançado | Pode causar perda de dados ou incompatibilidade entre schema e app. |
| Configurar observabilidade, métricas e alertas | Media/alta | Modelo avançado ou intermediário forte | Precisa transformar falhas reais em sinais acionáveis. |
| Teste de carga e análise de gargalos | Media/alta | Modelo avançado | Exige leitura de resultados, concorrência e impacto em checkout/check-in. |
| Criar ou ajustar testes unitários focados | Média | Modelo intermediário | Escopo geralmente local, desde que o contrato esteja claro. |
| Ajustar frontend sem mudar contrato sensível | Média | Modelo intermediário | Risco controlado, mas precisa build e validação de rotas. |
| Atualizar textos, docs, checklists e runbooks | Baixa/media | Modelo simples ou intermediário | Trabalho mais mecânico, com revisão humana. |
| Rodar comandos de validação e registrar resultados | Baixa | Modelo simples | Execução repetitiva com saída objetiva. |
| Revisar logs para ausência de secrets | Média | Modelo intermediário | Precisa reconhecer padrões de vazamento e falsos positivos. |
| Criar tarefas a partir de checklist aprovado | Baixa/media | Modelo simples ou intermediário | Bom para quebrar trabalho sem tomar decisões críticas. |

## Processo de Deploy em Staging

1. Confirmar working tree limpo.
2. Confirmar último commit no remote.
3. Configurar variáveis de staging.
4. Provisionar PostgreSQL, Redis, RabbitMQ, S3/CDN e SMTP.
5. Aplicar migrations.
6. Subir API.
7. Subir web.
8. Configurar mobile apontando para API staging.
9. Validar `GET /health`.
10. Validar `GET /metrics`.
11. Rodar checklist manual de staging.
12. Registrar resultado em `docs/staging-readiness.md` ou documento de release.

## Checklist Manual de Staging

### Auth

- Criar conta de organizador.
- Fazer login web.
- Confirmar que refresh token não aparece no localStorage.
- Executar refresh de sessão.
- Fazer logout.
- Testar recuperação de senha via SMTP.

### Eventos e Checkout

- Criar evento publicado.
- Criar lote com quantidade baixa.
- Fazer checkout.
- Confirmar reserva de estoque.
- Abrir página de sucesso com `orderId` e `accessToken`.
- Tentar abrir pedido sem `accessToken`; deve falhar.
- Tentar dois checkouts simultâneos no último ingresso; apenas um deve reservar.

### Pagamento e Webhook

- Criar preferência de pagamento sandbox.
- Simular pagamento aprovado.
- Confirmar status `PAID`.
- Confirmar emissão de tickets.
- Confirmar ledger único.
- Reenviar webhook duplicado; não deve duplicar tickets nem ledger.
- Verificar métricas de webhook em `/metrics`.

### QR e Check-in

- Abrir ticket emitido.
- Validar QR no check-in.
- Escanear mesmo QR novamente; deve retornar duplicado.
- Alterar payload do QR; deve ser rejeitado.
- Confirmar logs de check-in.

### Upload

- Fazer upload autenticado de imagem válida.
- Confirmar URL pública S3/CDN.
- Tentar arquivo com extensão inválida.
- Tentar arquivo com MIME/extensão falsa.

### Mobile

- Instalar app apontando para staging.
- Logar com operador com permissão `CHECK_IN`.
- Confirmar registro de device.
- Escanear QR online.
- Colocar dispositivo offline.
- Escanear QR.
- Voltar online e sincronizar.
- Confirmar lote de sync no backend.

## Processo de Deploy em Produção

Pre-condições:

- Staging aprovado.
- Backup recente criado.
- Restore testado pelo menos uma vez no ciclo de release.
- Plano de rollback definido.
- Gateway real configurado.
- Webhook real configurado.
- Alertas mínimos ativos.

Passos:

1. Anunciar janela de deploy.
2. Congelar novas mudanças ate finalizar deploy.
3. Criar backup do banco.
4. Aplicar migrations.
5. Deploy da API.
6. Smoke test da API: `/health`, `/metrics`, login.
7. Deploy da web.
8. Smoke test da web: página pública, login, checkout ate preferência.
9. Validar webhook com evento de teste controlado.
10. Validar upload.
11. Validar mobile com operador real de teste.
12. Monitorar logs e métricas por pelo menos 30 minutos.
13. Registrar resultado da release.

## Rollback

Quando acionar:

- API indisponível.
- Checkout falhando.
- Pagamento aprovado sem emitir ticket.
- Vazamento de dado sensível.
- Erro generalizado em login.
- Migration incompatibiliza o app.

Ordem:

1. Pausar deploys.
2. Identificar commit/release anterior estável.
3. Se não houve migration destrutiva, voltar app para versão anterior.
4. Se houve migration destrutiva, avaliar restore de backup antes de rollback.
5. Desabilitar feature afetada quando possível.
6. Comunicar impacto.
7. Registrar incidente e causa raiz.

Regra:

- Nunca executar rollback de banco sem backup e decisão explicita.
- Nunca apagar dados manualmente para "destravar" produção sem registro.

## Monitoramento

### Health

Endpoint:

- `/health`

Esperado:

- Status `ok`.
- Latência baixa.
- Sem erro 5xx.

### Métricas

Endpoint:

- `/metrics`

Métricas críticas:

- `eventflow_api_up`
- `eventflow_checkout_created_total`
- `eventflow_checkout_inventory_conflicts_total`
- `eventflow_payment_status_transitions_total`
- `eventflow_payment_tickets_emitted_total`
- `eventflow_webhooks_received_total`
- `eventflow_webhooks_processed_total`
- `eventflow_webhooks_duplicates_total`
- `eventflow_webhooks_unmatched_total`
- `eventflow_checkin_validations_total`
- `eventflow_checkin_signature_failures_total`

### Alertas Mínimos

Críticos:

- API fora do ar por mais de 2 minutos.
- Erro 5xx acima de 2 por cento por 5 minutos.
- Webhook com falha ou não encontrado acima do normal.
- Checkout sem criação de pedido durante campanha ativa.
- Pagamento `PAID` sem emissão de ticket.
- Banco indisponível.
- Redis indisponível.
- Fila travada ou crescendo continuamente.

Avisos:

- Latência p95 acima do alvo.
- Aumento de QR adulterado.
- Aumento de check-in duplicado.
- Aumento de conflito de estoque.
- Erro de SMTP.
- Erro de upload S3.

## Logs

Logs devem conter:

- Request id.
- Método.
- Path.
- Status.
- Duração.
- User id quando autenticado.
- Tenant id quando disponível.
- Módulo/ação.

Logs não podem conter:

- Senhas.
- JWT.
- Refresh token.
- Reset token.
- API keys.
- Documentos pessoais.
- QR payload completo.
- Dados de cartão.

## Incidentes

### Severidade

| Nível | Exemplo | Tempo alvo de resposta |
| --- | --- | --- |
| SEV1 | Checkout/pagamento fora, vazamento de dados, app indisponível | Imediato |
| SEV2 | Check-in instável, webhook parcial, uploads falhando | 30 min |
| SEV3 | Bug em dashboard, relatório atrasado, erro sem impacto financeiro | 1 dia útil |

### Processo

1. Declarar incidente.
2. Definir responsável.
3. Identificar tenants/eventos afetados.
4. Checar deploys recentes.
5. Checar API, banco, Redis, filas, storage e gateway.
6. Mitigar primeiro.
7. Corrigir causa raiz depois.
8. Criar postmortem em ate 48 horas.
9. Adicionar teste ou alerta para evitar repetição.

## Backups e Restore

Rotina mínima:

- Backup automático diário do PostgreSQL.
- Retenção mínima de 7 dias em staging e 30 dias em produção.
- Backup antes de qualquer migration em produção.
- Teste de restore mensal.

Teste de restore deve confirmar:

- Banco sobe.
- Migrations estão coerentes.
- Login funciona.
- Consulta de eventos funciona.
- Pedido/ticket histórico pode ser lido.
- Check-in não perde consistência.

## Rotação de Secrets

Quando rotacionar:

- Exposição acidental.
- Saída de colaborador com acesso.
- Incidente de segurança.
- Rotina trimestral para secrets críticos.

Ordem sugerida:

1. Criar novo secret.
2. Atualizar ambiente.
3. Fazer deploy/restart controlado.
4. Validar login, QR, webhook e SMTP.
5. Revogar secret antigo.
6. Registrar data e motivo.

## Rotina Semanal

- Conferir erros 5xx.
- Conferir métricas de checkout e webhook.
- Conferir conflitos de estoque.
- Conferir QR adulterado/duplicado.
- Conferir falhas de upload.
- Conferir filas e retries.
- Conferir backups.
- Rodar testes automatizados em branch principal.

## Rotina Mensal

- Testar restore.
- Revisar dependências com vulnerabilidades.
- Revisar usuários administrativos.
- Revisar API keys e secrets.
- Revisar custos de infra.
- Rodar teste de carga básico.
- Atualizar matriz de maturidade.

## Gates Para Liberar Produção

Antes da primeira produção real:

- Staging validado ponta a ponta.
- Pagamento real testado com valor controlado.
- Webhook real validado.
- SMTP real validado.
- S3/CDN validado.
- Mobile validado em aparelho físico.
- Backup criado.
- Restore testado.
- Alertas ativos.
- Política LGPD revisada.
- Termos e política de privacidade revisados.
- Plano de suporte definido.

## Pendências Conhecidas

| Pendência | Prioridade | Ação |
| --- | --- | --- |
| Assinatura criptográfica real do webhook AbacatePay | Alta | Implementar assim que o provedor oferecer contrato claro. |
| Teste de carga | Média | Criar cenários k6/Artillery para página pública, checkout e check-in. |
| Conciliação financeira automática | Média | Comparar ledger interno contra extratos do provedor. |
| 2FA end-to-end | Média | Implementar provisioning TOTP/app authenticator e testes. |
| Restore exercitado | Média | Criar rotina mensal e registrar evidências. |
| LGPD jurídico/operacional | Média | Revisar consentimento, retenção e exclusão com apoio legal. |
| Lock distribuído para seat holds em alto volume | Baixa | Avaliar Redis lock se seat maps tiverem carga alta. |

## Comandos de Referência

Validação completa:

```bash
git diff --check
pnpm --filter @eventflow/api test
pnpm --filter @eventflow/api build
pnpm --filter @eventflow/web build
pnpm --filter @eventflow/mobile test
pnpm --filter @eventflow/mobile typecheck
```

Migrations:

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

Smoke test HTTP:

```bash
curl -s https://api.eventflowtickets.com.br/health
curl -s https://api.eventflowtickets.com.br/metrics
```

## Dono do Processo

Enquanto não houver time formal de operação:

- Dono técnico: responsável pelo deploy e rollback.
- Dono de produto: aprova release e janela de operação.
- Dono de suporte: acompanha usuários/eventos durante primeiras vendas.

Nenhuma release com impacto em pagamento, checkout, ticket, upload, auth ou check-in deve sair sem dono técnico presente.
