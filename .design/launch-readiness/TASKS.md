# Checklist de lançamento: vendas de ingressos

Gerado a partir da auditoria técnica de 2026-09-07.

## Escopo e decisão

- [ ] **Manter a simulação de pagamento somente para testes**: manter `PAYMENT_SIMULATION_ENABLED=true` enquanto o sandbox estiver em validação. Esta decisão exclui a desativação da simulação desta checklist. Antes de produção real, criar uma tarefa separada para exigir `false` em produção e remover a rota pública de confirmação simulada. _Modifica: nenhuma funcionalidade agora; documenta a exceção operacional._

## Bloqueadores de receita e estoque

- [~] **Expirar pedidos PIX abandonados e liberar reserva**: job idempotente implementado com claim condicional e testes unitários; falta homologação concorrente real com webhook no staging. _Modifica: `ReservationExpirationService`, módulo de checkout e configuração._
  - Critério de aceite: pedido não pago vence após o TTL definido; estoque volta uma única vez; pedido pago no limite do TTL emite ingressos normalmente; execução repetida não altera saldos.
  - Testes: unidade de transições, integração de corrida webhook × expiração e teste com dois workers concorrentes.

- [~] **Reservar e devolver a cota de cupom corretamente**: reserva condicional e devolução em cancelamento/expiração foram implementadas e testadas; falta cenário de homologação de reembolso conforme regra comercial. _Modifica: `CreateCheckoutUseCase`, `CheckoutService`, `PaymentsService`._
  - Critério de aceite: carrinho abandonado não esgota cupom; dois checkouts concorrentes para a última cota deixam só um apto; reembolso segue a regra de negócio explicitada.

- [ ] **Expor prazo de pagamento ao comprador**: mostrar na tela de sucesso o horário de expiração do PIX, estado pendente/expirado e ação segura para tentar uma nova compra após a expiração. _Modifica: contrato de checkout e `apps/web/app/checkout/success/page.tsx`; reutiliza polling de status e componentes `Card`/`Alert`._
  - Critério de aceite: comprador entende até quando pode pagar e não vê QR/ingresso como confirmado antes do webhook.

## Portaria e integridade de ingresso

- [~] **Unificar validação online e offline de check-in**: sincronismo offline agora chama o validador online com QR assinado obrigatório; testes cobrem aceitação e recusa de payload não assinado. Falta homologação com dispositivos reais. _Modifica: `ValidateTicketUseCase` e `EnterpriseMobileService`._
  - Critério de aceite: QR adulterado, pagamento pendente/cancelado, evento encerrado e janela fechada são recusados nos dois canais; duplicidade offline é registrada sem segunda entrada.
  - Testes: matriz online/offline para cada estado e corrida entre scanner web, mobile e transferência.

- [ ] **Concluir a hardening da tela de portaria**: mostrar estado aberto/fechado, horário configurado, contadores por resultado e feedback claro para QR inválido, duplicado e pagamento pendente. _Modifica: `apps/web/app/(dashboard)/check-in/page.tsx`; reutiliza `Card`, `Badge` e `Tabs`._
  - Critério de aceite: operador identifica em segundos se pode iniciar a entrada e consegue diferenciar recusa de duplicidade.

## Assentos — não habilitar antes desta fatia

- [ ] **Tornar assento uma reserva transacional do checkout**: validar que cada `seatId` pertence ao mapa ativo do evento e ao lote compatível; criar reserva exclusiva com TTL no próprio checkout e só marcar `SOLD` após pagamento. Rejeitar IDs desconhecidos, repetidos, de outro evento ou já reservados/vendidos. _Modifica: schema de `SeatReservation`, `CreateCheckoutUseCase`, `PaymentsService`, serviços de seat map._
  - Critério de aceite: duas compras não conseguem o mesmo assento; cancelamento/expiração devolve apenas os assentos daquele pedido; payload adulterado não afeta outro evento.
  - Testes: concorrência, expiração, webhook pago, reembolso e autorização do produtor.

- [ ] **Não expor venda de assento marcado até a conclusão**: manter o recurso desligado/oculto para eventos de venda real enquanto a reserva transacional não passar nos testes. _Modifica: controles de produto e criação de evento; reutiliza `seatMapEnabled`._

## Deploy, operação e segurança

- [x] **Corrigir artefato Docker da web e validar imagem executável**: lockfile e dependências de workspace corrigidos, cópias inexistentes removidas e runtime desacoplado de download do pnpm. As imagens de API/web foram construídas do zero; API e web responderam `200` em containers. O gate Docker está no CI. _Modifica: `apps/web/Dockerfile`, `.github/workflows/ci.yml`._
  - Critério de aceite: `docker build` e `docker run` respondem `200` na home; proxy `/api/backend` funciona no container.

- [x] **Retirar deployment de worker inexistente**: manifesto que chamava `dist/worker.js` foi removido para não criar crash loop. _Modifica: `infra/k8s/worker-deployment.yaml`._
  - Critério de aceite: toda imagem/manifesta declarada inicia sem erro e possui health/readiness verificável.

- [~] **Higienizar webhooks e respostas de erro**: segredo de webhook removido da query string; logger agora registra apenas path e erros internos retornam mensagem genérica. Testes diretos do filtro e do logger cobrem a não exposição de detalhe interno e de segredo na URL. Falta adicionar request ID. _Modifica: `WebhooksController`, `RequestLoggerMiddleware`, `HttpExceptionFilter`._
  - Critério de aceite: logs não contêm `webhookSecret`, token, CPF, e-mail ou payload de pagamento; resposta 500 não revela mensagem interna.

- [~] **Tornar monitoramento acionável**: target inválido da web removido, porta RabbitMQ corrigida e alertas para API indisponível, webhook não conciliado e conflito de estoque adicionados. YAML validado; falta subir Prometheus/Grafana e disparar alertas em staging. _Modifica: `infra/monitoring/prometheus.yml`, `infra/monitoring/alerts.yml` e runbook._
  - Critério de aceite: gerar falha controlada cria sinal observável e runbook indica dono, diagnóstico e ação.

## Qualidade e homologação

- [x] **Criar teste E2E de venda principal**: cenário determinístico implementado e aprovado para evento publicado → checkout → webhook sandbox autenticado por segredo/HMAC → pagamento → emissão de ingresso → tela de sucesso → check-in → duplicidade. O CI prepara banco/Redis, seed e Chromium headless. Cancelamento/reembolso e devolução de estoque continuam cobertos por testes de serviço e devem ganhar uma fatia E2E separada. _Modifica: `apps/web/e2e/checkout.spec.ts` e ambiente de teste da API._
  - Critério de aceite: teste roda no CI contra banco/Redis efêmeros; não depende de estado manual nem de um evento fixo.

- [~] **Criar gates de produção no CI**: CI agora exige seed, testes, Playwright, build de ambos Dockerfiles e `git diff --check`. A configuração foi validada estaticamente; falta a primeira execução remota bem-sucedida no GitHub Actions. _Modifica: `.github/workflows/ci.yml`._

- [~] **Executar homologação de lançamento em staging**: a homologação local conteinerizada está aprovada para banco, Redis, API, web, compra, webhook assinado, emissão, check-in e duplicidade. Ainda falta repetir no staging compartilhado e registrar evidências de expiração, cupom, e-mail, transferência, scanner HTTPS (Android/iPhone/leitor USB), backup e restauração. _Reutiliza: `docs/staging-readiness.md` e runbooks._
  - Critério de aceite: cada cenário possui resultado, horário, responsável e link/log de evidência; nenhum P0/P1 fica aberto.

## Ordem obrigatória de execução

1. Expiração de pedidos e cota de cupom.
2. Check-in offline seguro.
3. Imagem web e worker/deploy.
4. Higiene de webhook/erros e monitoramento.
5. Assentos, somente se forem vendidos no primeiro evento; caso contrário mantê-los desabilitados.
6. E2E, gates e homologação de staging como condição final de venda.

## Regra de conclusão

Nenhum item é concluído sem teste automatizado proporcional ao risco, teste negativo de segurança quando aplicável, build do pacote afetado, `git diff --check` limpo e evidência de homologação para fluxos que cruzam pagamento, banco ou infraestrutura.
