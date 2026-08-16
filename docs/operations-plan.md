# Event Flow - Plano de Operacao

Atualizado em: 2026-08-16

Este documento define como operar o Event Flow em staging e producao depois do fechamento tecnico do hardening. Use junto com `docs/staging-readiness.md`, `docs/project-fix-checklist.md` e `docs/product-maturity.md`.

## Objetivos

- Subir staging de forma controlada.
- Validar fluxos criticos antes de producao.
- Reduzir risco de perda financeira, vazamento de dados e indisponibilidade.
- Padronizar deploy, rollback, monitoramento, incidentes e rotinas recorrentes.
- Impedir que codigo sem teste/build passe para deploy.

## Ordem Para Comecar

Execute o projeto nesta ordem. Nao avance para producao sem concluir staging com evidencia registrada.

1. Fechar documentacao operacional: `docs/operations-plan.md`, `docs/staging-readiness.md` e runbooks essenciais.
2. Confirmar que o repositorio esta limpo e que a branch atual esta sincronizada com o remote.
3. Rodar os gates locais obrigatorios de teste, build e whitespace.
4. Revisar variaveis obrigatorias e gerar secrets fortes para staging.
5. Provisionar staging: PostgreSQL, Redis, RabbitMQ, S3/CDN, SMTP, AbacatePay sandbox e monitoramento.
6. Aplicar migrations em staging e subir API.
7. Subir web e configurar mobile apontando para a API de staging.
8. Rodar smoke tests: `/health`, `/metrics`, login e pagina publica.
9. Executar checklist manual completo de staging: auth, checkout, pagamento/webhook, QR/check-in, upload e mobile.
10. Exercitar backup e restore em ambiente separado.
11. Ativar alertas minimos e confirmar que disparam em cenarios controlados.
12. Rodar teste de carga basico para pagina publica, checkout e check-in.
13. Registrar evidencias, falhas e decisoes em documento de release.
14. Preparar producao somente depois de staging aprovado ponta a ponta.

## Ambientes

### Local

Uso:

- Desenvolvimento.
- Testes automatizados.
- Validacao rapida de fluxos sem servicos externos reais.

Regras:

- Pode usar secrets `dev-only-*`.
- Pode usar upload local como fallback.
- Nao deve usar credenciais reais de pagamento.
- Nao deve conter dados reais de cliente.

### Staging

Uso:

- Ensaiar operacao real.
- Testar pagamento sandbox.
- Validar SMTP, S3/CDN, migrations, mobile e webhooks.
- Fazer homologacao antes de producao.

Regras:

- `NODE_ENV=production`.
- Secrets fortes obrigatorios.
- Banco separado de producao.
- Gateway em sandbox.
- Dados ficticios ou anonimizados.
- Deploy so pode acontecer com testes e builds passando.

### Producao

Uso:

- Venda real.
- Check-in real.
- Dados reais de usuarios, compradores e organizadores.

Regras:

- Deploy somente depois de staging aprovado.
- Migrations devem ser revisadas antes de aplicar.
- Rollback deve estar definido antes do deploy.
- Backups e restore devem estar testados.
- Logs nao podem conter secrets, tokens, documentos ou payloads sensiveis.

## Servicos Obrigatorios

| Servico | Ambiente | Uso | Obrigatorio antes de producao |
| --- | --- | --- | --- |
| PostgreSQL | staging/producao | Banco principal | Sim |
| Redis | staging/producao | Cache, rate limit, filas | Sim |
| RabbitMQ | staging/producao | Jobs e processamento async | Sim |
| S3 ou compativel | staging/producao | Uploads/assets | Sim |
| CDN/public URL | staging/producao | Entrega publica de assets | Sim |
| SMTP | staging/producao | Recuperacao de senha | Sim |
| AbacatePay sandbox | staging | Pagamento homologado | Sim para staging |
| AbacatePay producao | producao | Pagamento real | Sim para producao |
| Prometheus/Grafana | staging/producao | Metricas | Sim |
| Loki ou equivalente | staging/producao | Logs centralizados | Recomendado |

## Variaveis Obrigatorias

Configurar em staging e producao:

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

- Minimo de 32 caracteres para JWT/QR secrets.
- Nunca usar `change-me-*` ou `dev-only-*` em staging/producao.
- Nunca commitar `.env`.
- Rotacionar secrets se forem expostos em terminal, log, print ou chat.
- Para Cloudflare R2, configurar tambem `AWS_S3_ENDPOINT`, `AWS_REGION=auto` e `AWS_S3_FORCE_PATH_STYLE=true`.

## Gates Obrigatorios de Deploy

Nenhum deploy pode seguir se algum item falhar:

```bash
git diff --check
pnpm --filter @eventflow/api test
pnpm --filter @eventflow/api build
pnpm --filter @eventflow/web build
pnpm --filter @eventflow/mobile test
pnpm --filter @eventflow/mobile typecheck
```

## Regra Obrigatoria de Testes Por Mudanca

Toda mudanca de codigo, configuracao, schema, infraestrutura ou contrato de API deve vir acompanhada de testes proporcionais ao risco. A regra vale para local, staging e producao.

Obrigatorio para qualquer mudanca:

- Rodar o teste focado do modulo alterado.
- Rodar build/typecheck do pacote alterado.
- Rodar `git diff --check`.
- Confirmar que nenhuma rota existente que dependa do modulo foi quebrada.
- Confirmar que nenhum secret, token, chave de API, payload sensivel, documento pessoal ou QR completo foi adicionado a logs, respostas HTTP, fixtures, prints, snapshots ou docs.
- Registrar no documento de release quais testes foram executados e o resultado.

Obrigatorio para mudancas em auth, permissao, checkout, pagamento, webhook, upload, ticket, QR, check-in, LGPD, logs ou variaveis de ambiente:

- Rodar a suite completa da API.
- Adicionar ou atualizar teste negativo para acesso indevido, vazamento de informacao sensivel ou payload adulterado.
- Validar que respostas HTTP nao retornam secrets, refresh tokens, reset tokens, API keys, dados de cartao, documentos pessoais desnecessarios ou QR payload completo.
- Validar que logs nao imprimem secrets, tokens, credenciais, documentos pessoais ou payloads sensiveis.
- Testar pelo menos um fluxo manual em staging antes de liberar producao.

Obrigatorio para mudancas que tocam rotas publicas ou frontend:

- Rodar build da web.
- Validar rota publica afetada.
- Validar estado de erro e ausencia de dados sensiveis na tela.
- Confirmar que URLs com token de acesso continuam restritas ao fluxo previsto.

Obrigatorio para mudancas em mobile:

- Rodar testes do mobile.
- Rodar typecheck do mobile.
- Validar login, armazenamento seguro de token, check-in online e sincronizacao offline quando o modulo for afetado.

Uma mudanca nao pode ser marcada como concluida se os testes obrigatorios nao foram executados. Se algum teste nao puder rodar, o item deve ficar bloqueado ou em andamento com motivo registrado.

Para mudancas que tocam banco:

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

Para mudancas de seguranca, pagamento, checkout, upload, webhook ou check-in:

- Rodar suite completa da API.
- Rodar teste focado do modulo afetado.
- Testar pelo menos um fluxo manual em staging.
- Atualizar docs se o contrato mudar.

## Uso Recomendado de Modelos de IA

Use modelos mais fortes nas operacoes com risco financeiro, seguranca, dados sensiveis, concorrencia ou infraestrutura. Use modelos mais simples em tarefas mecanicas, documentacao e validacoes repetitivas.

| Operacao | Complexidade | Modelo recomendado | Motivo |
| --- | --- | --- | --- |
| Planejar staging/producao, rollback e incidentes | Alta | Modelo avancado | Exige raciocinio de risco, ordem operacional e mitigacao. |
| Implementar auth, refresh token, permissoes e LGPD | Alta | Modelo avancado | Alto risco de vazamento, bypass de permissao e quebra de sessao. |
| Implementar checkout, estoque concorrente, pagamento e webhook | Alta | Modelo avancado | Envolve dinheiro, idempotencia, corrida e consistencia de banco. |
| Revisar migrations, backup e restore | Alta | Modelo avancado | Pode causar perda de dados ou incompatibilidade entre schema e app. |
| Configurar observabilidade, metricas e alertas | Media/alta | Modelo avancado ou intermediario forte | Precisa transformar falhas reais em sinais acionaveis. |
| Teste de carga e analise de gargalos | Media/alta | Modelo avancado | Exige leitura de resultados, concorrencia e impacto em checkout/check-in. |
| Criar ou ajustar testes unitarios focados | Media | Modelo intermediario | Escopo geralmente local, desde que o contrato esteja claro. |
| Ajustar frontend sem mudar contrato sensivel | Media | Modelo intermediario | Risco controlado, mas precisa build e validacao de rotas. |
| Atualizar textos, docs, checklists e runbooks | Baixa/media | Modelo simples ou intermediario | Trabalho mais mecanico, com revisao humana. |
| Rodar comandos de validacao e registrar resultados | Baixa | Modelo simples | Execucao repetitiva com saida objetiva. |
| Revisar logs para ausencia de secrets | Media | Modelo intermediario | Precisa reconhecer padroes de vazamento e falsos positivos. |
| Criar tarefas a partir de checklist aprovado | Baixa/media | Modelo simples ou intermediario | Bom para quebrar trabalho sem tomar decisoes criticas. |

## Processo de Deploy em Staging

1. Confirmar working tree limpo.
2. Confirmar ultimo commit no remote.
3. Configurar variaveis de staging.
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
- Confirmar que refresh token nao aparece no localStorage.
- Executar refresh de sessao.
- Fazer logout.
- Testar recuperacao de senha via SMTP.

### Eventos e Checkout

- Criar evento publicado.
- Criar lote com quantidade baixa.
- Fazer checkout.
- Confirmar reserva de estoque.
- Abrir pagina de sucesso com `orderId` e `accessToken`.
- Tentar abrir pedido sem `accessToken`; deve falhar.
- Tentar dois checkouts simultaneos no ultimo ingresso; apenas um deve reservar.

### Pagamento e Webhook

- Criar preferencia de pagamento sandbox.
- Simular pagamento aprovado.
- Confirmar status `PAID`.
- Confirmar emissao de tickets.
- Confirmar ledger unico.
- Reenviar webhook duplicado; nao deve duplicar tickets nem ledger.
- Verificar metricas de webhook em `/metrics`.

### QR e Check-in

- Abrir ticket emitido.
- Validar QR no check-in.
- Escanear mesmo QR novamente; deve retornar duplicado.
- Alterar payload do QR; deve ser rejeitado.
- Confirmar logs de check-in.

### Upload

- Fazer upload autenticado de imagem valida.
- Confirmar URL publica S3/CDN.
- Tentar arquivo com extensao invalida.
- Tentar arquivo com MIME/extensao falsa.

### Mobile

- Instalar app apontando para staging.
- Logar com operador com permissao `CHECK_IN`.
- Confirmar registro de device.
- Escanear QR online.
- Colocar dispositivo offline.
- Escanear QR.
- Voltar online e sincronizar.
- Confirmar lote de sync no backend.

## Processo de Deploy em Producao

Pre-condicoes:

- Staging aprovado.
- Backup recente criado.
- Restore testado pelo menos uma vez no ciclo de release.
- Plano de rollback definido.
- Gateway real configurado.
- Webhook real configurado.
- Alertas minimos ativos.

Passos:

1. Anunciar janela de deploy.
2. Congelar novas mudancas ate finalizar deploy.
3. Criar backup do banco.
4. Aplicar migrations.
5. Deploy da API.
6. Smoke test da API: `/health`, `/metrics`, login.
7. Deploy da web.
8. Smoke test da web: pagina publica, login, checkout ate preferencia.
9. Validar webhook com evento de teste controlado.
10. Validar upload.
11. Validar mobile com operador real de teste.
12. Monitorar logs e metricas por pelo menos 30 minutos.
13. Registrar resultado da release.

## Rollback

Quando acionar:

- API indisponivel.
- Checkout falhando.
- Pagamento aprovado sem emitir ticket.
- Vazamento de dado sensivel.
- Erro generalizado em login.
- Migration incompatibiliza o app.

Ordem:

1. Pausar deploys.
2. Identificar commit/release anterior estavel.
3. Se nao houve migration destrutiva, voltar app para versao anterior.
4. Se houve migration destrutiva, avaliar restore de backup antes de rollback.
5. Desabilitar feature afetada quando possivel.
6. Comunicar impacto.
7. Registrar incidente e causa raiz.

Regra:

- Nunca executar rollback de banco sem backup e decisao explicita.
- Nunca apagar dados manualmente para "destravar" producao sem registro.

## Monitoramento

### Health

Endpoint:

- `/health`

Esperado:

- Status `ok`.
- Latencia baixa.
- Sem erro 5xx.

### Metricas

Endpoint:

- `/metrics`

Metricas criticas:

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

### Alertas Minimos

Criticos:

- API fora do ar por mais de 2 minutos.
- Erro 5xx acima de 2 por cento por 5 minutos.
- Webhook com falha ou nao encontrado acima do normal.
- Checkout sem criacao de pedido durante campanha ativa.
- Pagamento `PAID` sem emissao de ticket.
- Banco indisponivel.
- Redis indisponivel.
- Fila travada ou crescendo continuamente.

Avisos:

- Latencia p95 acima do alvo.
- Aumento de QR adulterado.
- Aumento de check-in duplicado.
- Aumento de conflito de estoque.
- Erro de SMTP.
- Erro de upload S3.

## Logs

Logs devem conter:

- Request id.
- Metodo.
- Path.
- Status.
- Duracao.
- User id quando autenticado.
- Tenant id quando disponivel.
- Modulo/acao.

Logs nao podem conter:

- Senhas.
- JWT.
- Refresh token.
- Reset token.
- API keys.
- Documentos pessoais.
- QR payload completo.
- Dados de cartao.

## Incidentes

### Severidade

| Nivel | Exemplo | Tempo alvo de resposta |
| --- | --- | --- |
| SEV1 | Checkout/pagamento fora, vazamento de dados, app indisponivel | Imediato |
| SEV2 | Check-in instavel, webhook parcial, uploads falhando | 30 min |
| SEV3 | Bug em dashboard, relatorio atrasado, erro sem impacto financeiro | 1 dia util |

### Processo

1. Declarar incidente.
2. Definir responsavel.
3. Identificar tenants/eventos afetados.
4. Checar deploys recentes.
5. Checar API, banco, Redis, filas, storage e gateway.
6. Mitigar primeiro.
7. Corrigir causa raiz depois.
8. Criar postmortem em ate 48 horas.
9. Adicionar teste ou alerta para evitar repeticao.

## Backups e Restore

Rotina minima:

- Backup automatico diario do PostgreSQL.
- Retencao minima de 7 dias em staging e 30 dias em producao.
- Backup antes de qualquer migration em producao.
- Teste de restore mensal.

Teste de restore deve confirmar:

- Banco sobe.
- Migrations estao coerentes.
- Login funciona.
- Consulta de eventos funciona.
- Pedido/ticket historico pode ser lido.
- Check-in nao perde consistencia.

## Rotacao de Secrets

Quando rotacionar:

- Exposicao acidental.
- Saida de colaborador com acesso.
- Incidente de seguranca.
- Rotina trimestral para secrets criticos.

Ordem sugerida:

1. Criar novo secret.
2. Atualizar ambiente.
3. Fazer deploy/restart controlado.
4. Validar login, QR, webhook e SMTP.
5. Revogar secret antigo.
6. Registrar data e motivo.

## Rotina Semanal

- Conferir erros 5xx.
- Conferir metricas de checkout e webhook.
- Conferir conflitos de estoque.
- Conferir QR adulterado/duplicado.
- Conferir falhas de upload.
- Conferir filas e retries.
- Conferir backups.
- Rodar testes automatizados em branch principal.

## Rotina Mensal

- Testar restore.
- Revisar dependencias com vulnerabilidades.
- Revisar usuarios administrativos.
- Revisar API keys e secrets.
- Revisar custos de infra.
- Rodar teste de carga basico.
- Atualizar matriz de maturidade.

## Gates Para Liberar Producao

Antes da primeira producao real:

- Staging validado ponta a ponta.
- Pagamento real testado com valor controlado.
- Webhook real validado.
- SMTP real validado.
- S3/CDN validado.
- Mobile validado em aparelho fisico.
- Backup criado.
- Restore testado.
- Alertas ativos.
- Politica LGPD revisada.
- Termos e politica de privacidade revisados.
- Plano de suporte definido.

## Pendencias Conhecidas

| Pendencia | Prioridade | Acao |
| --- | --- | --- |
| Assinatura criptografica real do webhook AbacatePay | Alta | Implementar assim que o provedor oferecer contrato claro. |
| Teste de carga | Media | Criar cenarios k6/Artillery para pagina publica, checkout e check-in. |
| Conciliacao financeira automatica | Media | Comparar ledger interno contra extratos do provedor. |
| 2FA end-to-end | Media | Implementar provisioning TOTP/app authenticator e testes. |
| Restore exercitado | Media | Criar rotina mensal e registrar evidencias. |
| LGPD juridico/operacional | Media | Revisar consentimento, retencao e exclusao com apoio legal. |
| Lock distribuido para seat holds em alto volume | Baixa | Avaliar Redis lock se seat maps tiverem carga alta. |

## Comandos de Referencia

Validacao completa:

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
curl -s https://api.seu-dominio.com/health
curl -s https://api.seu-dominio.com/metrics
```

## Dono do Processo

Enquanto nao houver time formal de operacao:

- Dono tecnico: responsavel pelo deploy e rollback.
- Dono de produto: aprova release e janela de operacao.
- Dono de suporte: acompanha usuarios/eventos durante primeiras vendas.

Nenhuma release com impacto em pagamento, checkout, ticket, upload, auth ou check-in deve sair sem dono tecnico presente.
