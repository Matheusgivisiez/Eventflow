# Plano de integracao InfinitePay e PaymentProvider

Data: 2026-09-15. Status: proposta tecnica; nenhuma integracao implementada.

## 0. Revisao: entrega minima para o lote Promocional

Contexto informado: abertura em 17/09, lote de 50 ingressos, evento de 600 ingressos no dia 22. A proposta original misturava a entrega urgente com a arquitetura futura. Esta secao define o escopo de lancamento e prevalece sobre as secoes posteriores, que ficam como referencia tecnica e backlog apos o evento.

### Decisoes antes de implementar

1. Identificar por que AbacatePay nao funciona: habilitacao pendente, bloqueio, erro tecnico ou custo. Ainda nao temos essa resposta; nao atribuir a troca a preco por suposicao. Se estiver operacional e passar uma compra completa em producao, priorizar abrir com ele.
2. Identificar titular e CPF/CNPJ da conta recebedora. Obter resposta escrita da InfinitePay sobre venda de ingressos de produtor terceiro, identificando o fluxo real. Ausencia de contrato publico de API nao significa proibicao nem prova disponibilidade.
3. Validar com a contabilidade o tratamento dos valores recebidos e da comissao; nao presumir que todo recebimento e receita propria nem que somente a comissao sera tributada.
4. Registrar com o produtor quem recebe, quem devolve, quem atende o comprador, quem arca com cancelamento do evento e quem absorve chargebacks e suas tarifas. Um acordo interno nao deve ser tratado como limitacao automatica dos direitos do comprador ou das cobrancas do provedor.
5. Confirmar na conta taxas, parcelamento e datas de disponibilidade dos recursos. Definir repasse pela liquidacao efetiva, com tratamento acordado de contestacoes posteriores, e nao pela simples aprovacao da venda.

### Teste decisivo, limitado a 1-2 horas de investigacao

Preparar dois pedidos de teste A e B com o mesmo valor; pagar apenas A, com valor pequeno aceito pelo provedor (R$ 1 se permitido). O titular executa o pagamento. Registrar payloads/respostas com dados sensiveis removidos.

- Controle positivo: consultar A com todas as referencias corretas; deve confirmar o pagamento e valor esperados.
- Controle negativo: consultar B nao pago; nao pode ser aprovado.
- Trocar apenas order_nsu de A pelo de B, mantendo slug e transaction_nsu de A. Repetir alterando slug e transaction_nsu separadamente, com referencias validas quando disponiveis; testar conta diferente somente com contas de teste autorizadas.
- Verificar se a resposta prova o vinculo pedido/conta/transacao, em vez de apenas confirmar que uma transacao existe. HTTP 200 ou success=true, isoladamente, nao aprovam pedido.
- Conferir no painel recebimento, taxa e metodo; exercitar devolucao manual e documentar evidencias. O prazo de conclusao externa da devolucao pode exceder a janela do teste.

Falha no vinculo bloqueia a liberacao automatica com esse contrato. Um teste positivo permite continuar a homologacao, mas nao demonstra sozinho todos os requisitos de seguranca ou autorizacao comercial. Nao executar pagamento real silenciosamente nem usar dados de terceiros.

### Arvore de decisao

| Condicao | Decisao para dia 17 |
| --- | --- |
| AbacatePay operacional, compra completa validada | Manter AbacatePay; priorizar correcao de concorrencia e controles operacionais. |
| AbacatePay indisponivel; InfinitePay autorizada para o fluxo; teste e homologacao aprovados | Implementar somente o minimo abaixo. |
| Vinculo de pagamento inseguro, autorizacao sem resposta ou testes essenciais incompletos | Nao abrir pelo fluxo automatico proposto; adiar lote. |

### Implementacao minima

- Interface PaymentProvider com createCheckout e verifyPayment, wrapper AbacatePay e adaptador InfinitePay. Registro simples dos dois provedores; catalogo amplo de capabilities fica para depois.
- Usar Payment.provider, que JA existe. Gravar na criacao e nunca trocar em pedido antigo. Preservar referencias existentes; adicionar apenas persistencia necessaria para conta, URL e estado de criacao desconhecido.
- Sem retry automatico de criacao ambigua. UNKNOWN fica em lista de revisao; nao cancelar imediatamente nem criar novo link as cegas.
- Webhook grava PaymentLog existente e tenta verificacao sincrona com timeout limitado. Falha ou resultado inconclusivo permanece nao processado para conferencia/reprocessamento manual. HTTP 200 so depois de persistir; se persistencia falhar, responder erro. Nao depender de retries externos para recuperar eventos.
- Sem worker novo, lease de processamento, BullMQ ou backoff automatico nesta entrega. Evento gravado e lista de pendencias sao necessarios para recuperacao, mesmo com 50 vendas.
- Lock transacional por pedido, compartilhado por confirmacao e expiracao. Vinculo unico de transacao externa, verificacao de valor e protecao de ingresso/ledger/comissao continuam obrigatorios. Chamada externa fora do lock.
- Pagamento tardio, divergente e sem referencias vai para revisao manual; nao reabrir pedido cancelado automaticamente. Conferir estoque antes de qualquer entrega e registrar eventual devolucao.
- Ajuste pequeno na pagina de retorno para enviar referencias quando disponiveis e exibir o estado local. Remover promessa de pagamento exclusivamente Pix se a conta nao permitir restringir metodos. Manter simulacao bloqueada em producao.
- Lista protegida de pedidos pendentes, UNKNOWN e eventos nao processados, com consulta/exportacao simples; reutilizar painel existente quando possivel. Operador responsavel confere cada venda no painel InfinitePay. Reprocessamento usa o mesmo fluxo protegido; comprovante enviado pelo comprador nao basta.
- Desabilitar no backend a execucao automatica de saques neste piloto; esconder botao sozinho nao basta. Solicitar/devolver/repassar dinheiro pelo operador, com registro externo restrito: pedido, valor bruto, taxa, valor liquidado, beneficiario, data, referencia/comprovante, responsavel e situacao. Sem novo motor financeiro ou tela de liquidacao.
- Nao apresentar saldo contabil atual como saldo disponivel para saque. Nao marcar reembolso como concluido ou saque como pago por simples solicitacao. Se ajustes contabil/estoque nao forem suportados com seguranca, registrar pendencia e restringir o fluxo atual ate conciliacao.

### Cartao, liquidacao e margem

Antes de habilitar cartao, preencher tabela operacional com Pix, credito 1x e cada parcelamento permitido: taxa percentual, tarifa fixa, antecipacao, quem paga acrescimos, prazo de liquidacao, custo de devolucao e chargeback. Valores devem vir da conta/proposta aplicavel, nao de taxa promocional generica.

Modelo de calculo para decisao, nao cotacao: margem de contribuicao por pedido = feeCents - custo efetivo do gateway - outros custos variaveis assumidos pela EventFlow. O custo usa a base efetivamente tarifada; nao subtrair percentuais de bases diferentes. Se a base do ingresso for R$ 100 e os 8% forem adicionados ao comprador, a venda sera R$ 108. Uma taxa HIPOTETICA de 4% sobre R$ 108 custa R$ 4,32, deixando R$ 3,68 dos R$ 8 antes dos demais custos. Se o produtor absorver a comissao, a cobranca seria R$ 100 e o mesmo percentual hipotetico custaria R$ 4.

Decidir expressamente quem assume taxas, antecipacao e perdas. Se o parcelamento nao fechar a conta, desabilita-lo na conta quando suportado ou nao ativar esse fluxo ate resolver; nao presumir que a API permite limitar formas de pagamento.

### Testes obrigatorios do minimo

1. Compra correta: pagamento verificado, um conjunto de ingressos, credito e comissao corretos, e check-in sem duplicidade.
2. Webhook falso, valor incorreto e transacao de outro pedido nao liberam ingresso.
3. Dois callbacks simultaneos e replay, usando PostgreSQL real, nao duplicam efeitos.
4. Timeout de criacao/verificacao e reinicio deixam pendencia recuperavel; nenhuma nova cobranca automatica.
5. Corrida com expiracao e pagamento tardio nao emitem ingresso sem estoque.
6. Pedido AbacatePay antigo continua roteado corretamente; token do pedido e simulacao em producao seguem protegidos.
7. Saque automatico bloqueado; conferencia, devolucao e repasse manuais com evidencia e responsavel definidos.

Reservar o primeiro dia para decisao e implementacao minima; o segundo para validacao e correcao, sem adicionar funcionalidades. Nao usar a estimativa original de 24-40h como compromisso de entrega. Se faltar tempo para esses testes, nao ativar.

### Deploy do banco

Substituir db push no start por migracoes versionadas no processo de release e start apenas da aplicacao. Antes de usar prisma migrate deploy, verificar historico aplicado, drift e eventuais mudancas feitas anteriormente com db push. O repositorio tem migrations, mas isso nao prova alinhamento do banco de producao. Ensaiar em copia restaurada, preparar backup e baseline/reconciliacao se necessario. Nao trocar apenas o comando e executar migrations antigas as cegas.

### Depois do dia 22

Reavaliar necessidade de worker automatico, lease, retries, capacidades extensas, reconciliacao avancada e novo dominio financeiro. As secoes 1-11 abaixo documentam esse desenho ampliado; nao sao requisito integral do lote de 50 ingressos.

## 1. Decisao proposta

Usar checkout hospedado da InfinitePay como adaptador temporario de cobranca. Manter regras de pedido, precificacao, estoque, ingressos e notificacoes na EventFlow. Introduzir PaymentProvider e um registro de provedores no modulo Payments existente, sem criar microservico.

Selecionar o provedor apenas na criacao do pagamento. Consultas, callbacks e conciliacao sempre usam o provedor persistido naquele pagamento. Uma troca de configuracao afeta somente pedidos novos. Manter o adaptador e o webhook AbacatePay para pedidos antigos.

Esta proposta nao entrega o modelo completo de marketplace solicitado anteriormente. Recebimento centralizado ou por organizador e uma decisao operacional pendente. Nao ativar vendas de terceiros assumindo split automatico. Confirmar com a InfinitePay o enquadramento da EventFlow e a conta recebedora antes da ativacao.

## 2. Evidencias do projeto

| Area | Local atual | Consequencia para a integracao |
| --- | --- | --- |
| Pedido e estoque | `apps/api/src/modules/checkout/use-cases/create-checkout.use-case.ts` | Reserva estoque atomicamente, calcula taxa de 8%, cupons e comissoes; fixa PIX e abacate_pay. |
| Criacao externa | `apps/api/src/modules/checkout/checkout.service.ts` | Chama gateway depois do commit; qualquer falha cancela pedido e libera estoque. |
| Pagamentos | `apps/api/src/modules/payments/payments.service.ts` | Injeta AbacatePay diretamente; concentra confirmacao, ingresso, ledger e e-mail. |
| Consulta publica | `apps/api/src/modules/checkout/checkout.service.ts` | Exige token do pedido e tenta reconciliar pendencias com janela de 15 segundos. |
| Webhooks | `apps/api/src/modules/webhooks/` | Parser por provedor, log com chave unica e processamento sincrono. |
| Expiracao | `apps/api/src/modules/checkout/reservation-expiration.service.ts` | Cancela pedidos pendentes apos TTL, padrao 30 minutos; nao cancela checkout externo. |
| Banco | `apps/api/prisma/schema.prisma` | Um Payment por Order; provider string; referencias opcionais; PaymentLog unico por provedor/evento. |
| Financeiro | `apps/api/src/modules/finance/finance.service.ts` | Saques chamam AbacatePay diretamente; saldo usa ledger, sem segregacao por custodiante. |
| Reembolso | `apps/api/src/modules/buyer/buyer.service.ts` | Cancela ingresso e libera estoque, registra solicitacao; nao devolve dinheiro pelo gateway. |
| Interface | `apps/web/app/checkout/[slug]/page.tsx` | Formulario fixado em PIX; redireciona por checkoutUrl. |
| Retorno | `apps/web/app/checkout/success/page.tsx` | Consulta status a cada 4 segundos; status=paid tenta confirmacao simulada. |

O schema ainda tem default de provider=mercado_pago, embora o fluxo atual grave abacate_pay explicitamente. Nao reclassificar registros antigos pelo novo default.

## 3. Contrato externo e lacunas

A documentacao descreve `POST /links` com handle, items em centavos, order_nsu, redirect_url e webhook_url. A consulta `POST /payment_check` recebe handle, order_nsu, transaction_nsu e slug. O retorno inclui success, paid, amount, paid_amount e capture_method. O webhook de aprovacao usa invoice_slug; o redirecionamento usa slug. Recomenda resposta HTTP 200 rapida; informa retentativa para 400. Fonte: [documentacao oficial](https://www.infinitepay.io/checkout-documentacao).

Nao encontrei nessa documentacao contratos de split, recebedores, saque, estorno via API, sandbox dedicado, assinatura de webhook, idempotency key, expiracao/cancelamento de link ou consulta somente por pedido. Ausencia de documentacao nao prova indisponibilidade comercial. O exemplo de items tem uma inconsistência textual com itens; homologar payload e resposta reais. Fonte: [documentacao oficial](https://www.infinitepay.io/checkout-documentacao).

O artigo oficial descreve checkout com Pix e cartao e configuracao de credenciais no painel; verificar se a conta exige configuracao adicional, pois o guia tecnico publico nao detalha esse fluxo. Fonte: [integracao InfinitePay](https://www.infinitepay.io/blog/integracao-infinitepay).

A central descreve cancelamento pelo aplicativo. Isso nao constitui contrato de API para automatizar reembolsos. Fonte: [cancelamento de vendas](https://ajuda.infinitepay.io/pt-BR/articles/6097686-como-funciona-o-cancelamento-de-vendas).

## 4. Abstracao proposta

```text
CheckoutService -> PaymentsService -> PaymentProviderRegistry
                                     |-> AbacatePayProvider -> gateway existente
                                     |-> InfinitePayProvider -> cliente HTTP

Webhook/retorno -> verificacao externa -> PaymentsService -> transacao local
                                                           |-> ingressos
                                                           |-> ledger/comissoes
                                                           |-> notificacao apos commit
```

Contrato conceitual, a implementar com DTOs tipados e validacao de runtime:

```ts
interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly capabilities: PaymentProviderCapabilities;
  createCheckout(input: CreatePaymentCheckout): Promise<CreatedPaymentCheckout>;
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerification>;
}

type PaymentVerification =
  | { kind: "verified"; payment: VerifiedProviderPayment }
  | { kind: "not_paid" }
  | { kind: "insufficient_reference" }
  | { kind: "unavailable" };
```

- `CreatePaymentCheckout`: identificador local, valor final em centavos, descricao, comprador, URLs e contexto de conta persistido. Nao recebe produtos ou clientes proprietarios do AbacatePay.
- `CreatedPaymentCheckout`: checkoutUrl e referencias externas opcionais. Nao exigir transactionId na criacao nem inventar um identificador remoto usando o ID local.
- `VerifyPaymentInput`: referencias persistidas e, quando necessario, pistas do callback. Adaptador traduz para o formato externo.
- `VerifiedProviderPayment`: status, valor, metodo efetivo, referencias e evidencia de verificacao. Status desconhecido nao vira PENDING automaticamente nem regride um pagamento aprovado.
- Capabilities expressam checkout hospedado, metodos, consulta com/sem referencia de transacao e operacoes comprovadamente disponiveis. Recursos nao documentados permanecem indisponiveis no adaptador.
- `PaymentProviderRegistry.forNewPayment()` resolve a configuracao; `get(payment.provider)` resolve registros existentes. ID desconhecido falha explicitamente.
- Parsers e autenticacao de webhook ficam em adaptadores de entrada, separados das regras de negocio. Implementacoes de cobranca nao escrevem diretamente no Prisma nem emitem ingressos.
- Reembolso, recebedores, split e payout merecem contratos separados quando houver um provedor com suporte confirmado; nao criar metodos vazios que retornam sucesso.

## 5. Persistencia e compatibilidade

Manter Payment e Order; nao introduzir multiplas tentativas pagaveis por pedido nesta etapa. Uma tentativa ambigua nao autoriza gerar outro checkout automaticamente.

Migracao aditiva proposta:

- Payment.checkoutUrl opcional, para recuperar o link existente.
- Payment.providerAccountRef opcional: snapshot da conta/handle utilizada. Nao armazenar credenciais neste campo.
- Payment.providerMetadata JSON opcional e versionado, validado por adaptador, para valores efetivamente pagos, parcelas e referencias adicionais.
- Payment.checkoutCreationState opcional: CREATING, READY, UNKNOWN, FAILED; claim com prazo para concorrencia. Desacoplar criacao externa do status financeiro.
- PaymentLog: campos de tentativas, proxima tentativa, claim/lease, ultimo erro resumido e revisao necessaria. Aproveitar o log como inbox duravel.
- Restricao unica para transacao externa por provedor e conta; verificar duplicatas antes de aplicar. Nao usar dedupe do webhook como unica protecao contra reutilizacao de transacao.

Preservar providerRef, checkoutId, billId e transactionId atuais. Para InfinitePay, invoice_slug pode preencher checkoutId apos validacao; transaction_nsu preenche transactionId. Nao inferir slug pela URL sem contrato confirmado. Mapear registros AbacatePay existentes no adaptador sem renomear campos de forma destrutiva.

Registrar explicitamente o provider na mesma transacao que cria Order/Payment. A selecao nao deve mudar entre criar o pedido e chamar o gateway. Backfill de conta, se necessario, deve usar evidencia operacional; nunca atribuir a conta atual indiscriminadamente a pagamentos historicos.

Preservar orderId, orderAccessToken, status e checkoutUrl da resposta publica. DTOs do frontend/SDK so recebem campos adicionais quando necessarios. Inspecionar consumidores de Payment.method antes de permitir null; sugestao inicial: campo adicional de metodo confirmado, com o metodo antigo tratado como solicitado ate a verificacao.

O start atual executa prisma db push. Preparar SQL revisavel e testar em copia local/staging antes do deploy, sem depender de alteracoes destrutivas automaticas. Fazer rollout de schema antes do codigo consumidor.

## 6. Fluxos a implementar

### Criacao

1. Validar provedor e configuracao antes de reservar estoque.
2. Criar pedido e pagamento com provedor/conta fixos, usando os calculos atuais.
3. Obter claim exclusivo de criacao e reutilizar checkoutUrl quando READY. Rejeitar criacao para pedido pago, cancelado ou estornado.
4. No adaptador, representar inicialmente o pedido como item agregado pelo totalCents. Essa decisao preserva exatamente desconto e taxa sem arredondamento por ingresso. Tratar total zero em fluxo interno de gratuidade, sem tentar cobrar zero.
5. Chamar a API fora da transacao de banco; timeout finito. Retry de consulta pode usar backoff; retry de criacao exige evidencia de idempotencia externa.
6. Persistir resultado antes de entregar URL. Falha definitiva permite compensacao unica; timeout, resposta invalida ou falha ao persistir apos sucesso remoto deixam estado UNKNOWN, com revisao/recuperacao, sem novo link automatico.
7. Definir contrato de resposta para UNKNOWN que permita consultar o pedido e nao induza o comprador a repetir a compra cegamente.

### Confirmacao

1. Endpoint dedicado `POST /webhooks/infinitepay`, com DTO, limite de payload e resposta explicita 200. Nest retorna 201 em POST por padrao: usar HttpCode(200).
2. Segredo aleatorio na URL pode servir como barreira adicional se a plataforma preservar a query; homologar isso. Redigir logs para nao guardar segredo nem token publico do pedido. Nao tratar essa barreira como prova de pagamento.
3. Persistir evento na inbox antes de responder; payload nao verificado nunca altera pagamento. Dedupe por provedor, conta, tipo de evento e transacao; conservar evidencias divergentes em vez de sobrescrever evento ja processado.
4. Worker com claim no banco consulta o provedor. Reaproveitar o padrao de servico periodico ja existente, com lease persistido para multiplas instancias e recuperacao apos reinicio. Enfileirar em BullMQ pode acelerar processamento, mas inbox continua fonte duravel e recuperavel.
5. Validar pagamento positivo, pedido, conta, referencias e valor contra dados persistidos. Confirmar na homologacao que payment_check realmente vincula todos os identificadores enviados: testar uma transacao real do pedido A contra pedido B. Sem essa garantia, liberar ingressos automaticamente fica bloqueado.
6. Comparar valor base confirmado ao totalCents; guardar paid_amount separadamente. A semantica de taxas/parcelamento precisa ser homologada; diferenca nao deve alterar a comissao EventFlow por inferencia.
7. Executar confirmacao e fulfillment em uma transacao local serializada por pedido. Marcar inbox processada atomicamente com os efeitos de negocio. E-mail ocorre depois do commit e continua com dedupe/retry existente.
8. Eventos invalidos, divergentes ou sem referencias suficientes ficam registrados para revisao. Falhas temporarias sao repetidas com backoff; nunca confirmar por timeout ou apenas pelo corpo do webhook.

### Retorno e conciliacao

- Acrescentar endpoint autenticado pelo token do pedido para receber pistas do retorno. O frontend envia apenas campos permitidos, e o backend consulta o gateway antes de persistir referencias como verificadas.
- `status=paid` e parametros da URL nunca aprovam uma venda real. Separar retorno real do caminho de simulacao e manter bloqueio de simulacao em producao.
- Atualizar a pagina de sucesso para encaminhar as referencias e continuar consultando o estado local. Limitar chamadas externas por pagamento, inclusive quando o navegador repete a URL.
- Sem referencias necessarias, retornar insufficient_reference; nao produzir polling externo inutil. Se webhook e retorno faltarem, a recuperacao automatica pode ser impossivel com o contrato publico: disponibilizar fila de pendencias e procedimento operacional de conciliacao.
- Mostrar meio efetivamente confirmado. A UI hoje fixa PIX; para InfinitePay, a escolha deve ocorrer no checkout hospedado e a EventFlow nao deve prometer exclusividade de PIX sem parametro confirmado.

## 7. Correcoes exigidas para a troca

### Concorrencia

Hoje verificacoes como contar ingressos e procurar ledger antes de criar nao garantem unicidade entre duas transacoes simultaneas. A leitura inicial de status tambem nao bloqueia concorrentes. Os testes existentes demonstram replay sequencial, nao concorrencia real.

Usar lock por pedido dentro da transacao, com ordem de locks comum entre pagamento, cancelamento e expiracao. Revalidar status apos adquirir o lock. Alternativa valida e transacao Serializable com retries limitados. Comissoes, ledger, estoque e ingressos devem mudar uma unica vez. Nenhuma chamada externa deve manter o lock aberto.

### Expiracao e pagamento tardio

Nao manter a suposicao de que cancelar a reserva local cancela a cobranca externa. Confirmar prazo/invalidacao do link com o provedor. Aumentar o TTL apenas reduz a frequencia do problema.

Proposta: registrar recebimento externo tardio separadamente quando o pedido ja estiver cancelado, sem forcar CANCELED -> PAID nem emitir ingresso sem estoque. Criar pendencia operacional duravel para devolucao ou atendimento com disponibilidade revalidada. O comprador deve ver que o pagamento esta em analise, em vez de ficar preso em "aguardando pagamento". Essa pendencia precisa aparecer para a equipe, com responsavel e evidencia.

Conciliar antes da expiracao quando houver referencias ajuda, mas nao elimina a corrida. O mesmo lock deve proteger expiracao e confirmacao. Testar explicitamente recebimento depois de liberar o ultimo ingresso.

### Saques, estornos e saldo

- Desacoplar aprovacao de saque da chamada fixa ao AbacatePay antes de receber pela InfinitePay. O saldo atual mistura origens e nao justifica transferir fundos por outra conta automaticamente.
- Para a fase temporaria, usar liquidacao manual auditada: solicitacao, verificacao de saldo realmente liquidado, transferencia pelo operador e registro de comprovante/referencia. Nunca marcar PAID so por aprovacao administrativa. Restringir permissoes e evitar duplo processamento.
- Solicitar reembolso e concluir devolucao sao estados distintos. Criar acompanhamento duravel de solicitacoes; registrar conclusao financeira apenas apos comprovacao externa.
- Ao concluir estorno, compensar ledger/comissoes uma unica vez e evitar segunda liberacao de estoque quando o ingresso ja foi cancelado individualmente. O fluxo atual de cancelamento terminal nao cria lancamento compensatorio de ledger.
- Nao oferecer reembolso parcial automatico: o status atual REFUNDED e de pagamento inteiro. Se houver devolucao parcial manual, registrar valor e ingresso afetado separadamente.
- Separar saldo contabil de valor disponivel para saque. Nao estimar taxa do gateway pela diferenca entre amount e paid_amount.

Essas medidas cobrem riscos presentes nas areas diretamente afetadas. Split, KYC, subcontas, reserva por evento e repasse automatico ficam para o provedor definitivo e exigirao extensao do dominio financeiro, nao apenas troca do adaptador.

## 8. Sequencia de entrega

| Etapa | Entrega verificavel | Condicao para avancar |
| --- | --- | --- |
| 1 | Confirmar conta, enquadramento, contratos e payload real | Identificadores vinculados corretamente e operacao temporaria definida |
| 2 | PaymentProvider, registry e wrapper AbacatePay | Fluxo atual e contratos publicos passam sem troca de provedor |
| 3 | Migracao aditiva, claim e confirmacao serializada | Concorrencia, replay e expiracao cobertos em banco real |
| 4 | InfinitePay, inbox, worker e retorno | Confirmacao somente apos verificacao externa |
| 5 | UI de pagamento, pendencias, saque/estorno manual auditado | Operacao nao aciona conta errada nem simula devolucao |
| 6 | Homologacao e ativacao controlada | Compra, ingresso, check-in, devolucao e rollback exercitados |

Estimativa de planejamento: 24-40 horas de engenharia concentrada, mais tempo externo de habilitacao/homologacao. O prazo de 48 horas e apertado; nao e possivel garantir ativacao pela leitura da documentacao. O adaptador isolado e pequeno, mas nao representa a entrega inteira. Se contratos essenciais nao forem confirmados, concluir a abstracao e manter InfinitePay desativada.

## 9. Configuracao e rollout

Variaveis propostas: PAYMENT_PROVIDER (definir `infinite_pay` no ambiente de vendas), INFINITEPAY_HANDLE, INFINITEPAY_WEBHOOK_SECRET, INFINITEPAY_BASE_URL, PAYMENT_WEBHOOK_WORKER_ENABLED e PAYOUT_MODE. Usar APP_URL/API_URL existentes. Validar configuracao por provedor ativo e manter credenciais antigas para conciliacao historica.

1. Publicar schema aditivo e abstração ainda usando AbacatePay.
2. Validar fixtures locais, regressao e staging. Simulacao local nao e sandbox oficial.
3. Homologar com conta real habilitada, transacoes controladas e devolucao comprovada.
4. Ativar para evento piloto por selecao server-side; confirmar metricas e atendimento das pendencias.
5. Expandir somente apos o ciclo completo. Monitorar criacao ambigua, atraso de webhook, divergencia de valor, pagamento tardio e repeticoes.
6. Reversao altera provedor apenas para novos pedidos. Continuar workers/webhooks dos dois provedores e preservar schema. Se AbacatePay ainda nao estiver operacional, rollback significa suspender novos checkouts, nao fingir que existe fallback funcional.

## 10. Verificacao

Baseline executada nesta analise: 7 suites, 39 testes aprovados (payments, gateway AbacatePay, checkout, use case, webhooks e finance). Sao testes existentes com mocks; nao comprovam integracao externa ou seguranca sob concorrencia. E2E existente inspecionado, mas nao executado; ele usa webhook AbacatePay e deve permanecer como regressao.

Adicionar testes de:

- Contrato dos dois adaptadores e roteamento de pedido antigo apos mudar PAYMENT_PROVIDER.
- Valor com cupom, taxa absorvida, taxa repassada, varios ingressos, centavos e total zero.
- Metodo confirmado diferente do inicialmente solicitado.
- Duplo clique, timeout externo, resposta invalida e falha de persistencia depois de criar checkout.
- Webhook falso, segredo invalido, transacao de outro pedido/conta, valor divergente e replay.
- Webhook antes de persistir resposta de criacao; retorno antes do webhook; retorno ausente.
- Worker encerrado apos claim, retry apos falha e duas instancias disputando evento.
- Confirmacoes simultaneas em PostgreSQL real: um conjunto de ingressos, um credito e uma comissao.
- Corrida de expiracao/confirmacao, pagamento tardio e estoque indisponivel.
- Reembolso de ingresso ja cancelado, ledger compensatorio e registro manual sem dupla devolucao.
- Saque sem chamada ao gateway errado, sem saldo liquidado e com duplo processamento.
- Token de pedido, isolamento de tenant, simulacao bloqueada em producao e retorno adulterado.
- E2E por provedor: pedido -> checkout -> verificacao -> ingresso -> e-mail -> check-in -> rejeicao de check-in duplicado.

## 11. Criterio de conclusao

A integracao esta pronta quando vendas novas usam o provedor escolhido, pagamentos historicos continuam conciliaveis, nenhuma notificacao nao verificada emite ingressos, concorrencia nao duplica efeitos, pendencias tardias/ambiguas sao recuperaveis e saque/reembolso refletem movimentacao financeira comprovada. A abstracao reduz o acoplamento tecnico, mas nao transforma um checkout simples em infraestrutura de marketplace.
