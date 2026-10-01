# Plano de integração InfinitePay e PaymentProvider

Data: 2026-09-15. Status: proposta tecnica; nenhuma integração implementada.

## 0. Revisão: entrega mínima para o lote Promocional

Contexto informado: abertura em 17/09, lote de 50 ingressos, evento de 600 ingressos no dia 22. A proposta original misturava a entrega urgente com a arquitetura futura. Esta seção define o escopo de lançamento e prevalece sobre as seções posteriores, que ficam como referência técnica e backlog após o evento.

### Decisões antes de implementar

1. Identificar por que AbacatePay não funciona: habilitação pendente, bloqueio, erro técnico ou custo. Ainda não temos essa resposta; não atribuir a troca a preço por suposição. Se estiver operacional e passar uma compra completa em produção, priorizar abrir com ele.
2. Identificar titular e CPF/CNPJ da conta recebedora. Obter resposta escrita da InfinitePay sobre venda de ingressos de produtor terceiro, identificando o fluxo real. Ausência de contrato público de API não significa proibição nem prova disponibilidade.
3. Validar com a contabilidade o tratamento dos valores recebidos e da comissao; não presumir que todo recebimento e receita própria nem que somente a comissão será tributada.
4. Registrar com o produtor quem recebe, quem devolve, quem atende o comprador, quem arca com cancelamento do evento e quem absorve chargebacks e suas tarifas. Um acordo interno não deve ser tratado como limitação automática dos direitos do comprador ou das cobranças do provedor.
5. Confirmar na conta taxas, parcelamento e datas de disponibilidade dos recursos. Definir repasse pela liquidação efetiva, com tratamento acordado de contestações posteriores, e não pela simples aprovação da venda.

### Teste decisivo, limitado a 1-2 horas de investigação

Preparar dois pedidos de teste A e B com o mesmo valor; pagar apenas A, com valor pequeno aceito pelo provedor (R$ 1 se permitido). O titular executa o pagamento. Registrar payloads/respostas com dados sensíveis removidos.

- Controle positivo: consultar A com todas as referências corretas; deve confirmar o pagamento e valor esperados.
- Controle negativo: consultar B não pago; não pode ser aprovado.
- Trocar apenas order_nsu de A pelo de B, mantendo slug e transaction_nsu de A. Repetir alterando slug e transaction_nsu separadamente, com referências válidas quando disponiveis; testar conta diferente somente com contas de teste autorizadas.
- Verificar se a resposta prova o vínculo pedido/conta/transação, em vez de apenas confirmar que uma transação existe. HTTP 200 ou success=true, isoladamente, não aprovam pedido.
- Conferir no painel recebimento, taxa e metodo; exercitar devolução manual e documentar evidências. O prazo de conclusão externa da devolução pode exceder a janela do teste.

Falha no vínculo bloqueia a liberação automática com esse contrato. Um teste positivo permite continuar a homologação, mas não demonstra sozinho todos os requisitos de segurança ou autorização comercial. Não executar pagamento real silenciosamente nem usar dados de terceiros.

### Árvore de decisão

| Condição | Decisão para dia 17 |
| --- | --- |
| AbacatePay operacional, compra completa validada | Manter AbacatePay; priorizar correção de concorrência e controles operacionais. |
| AbacatePay indisponivel; InfinitePay autorizada para o fluxo; teste e homologação aprovados | Implementar somente o mínimo abaixo. |
| Vínculo de pagamento inseguro, autorização sem resposta ou testes essenciais incompletos | Não abrir pelo fluxo automático proposto; adiar lote. |

### Implementação mínima

- Interface PaymentProvider com createCheckout e verifyPayment, wrapper AbacatePay e adaptador InfinitePay. Registro simples dos dois provedores; catálogo amplo de capabilities fica para depois.
- Usar Payment.provider, que JA existe. Gravar na criação e nunca trocar em pedido antigo. Preservar referências existentes; adicionar apenas persistência necessária para conta, URL e estado de criação desconhecido.
- Sem retry automático de criação ambígua. UNKNOWN fica em lista de revisao; não cancelar imediatamente nem criar novo link as cegas.
- Webhook grava PaymentLog existente e tenta verificação síncrona com timeout limitado. Falha ou resultado inconclusivo permanece não processado para conferência/reprocessamento manual. HTTP 200 só depois de persistir; se persistência falhar, responder erro. Não depender de retries externos para recuperar eventos.
- Sem worker novo, lease de processamento, BullMQ ou backoff automático nesta entrega. Evento gravado e lista de pendências são necessários para recuperação, mesmo com 50 vendas.
- Lock transacional por pedido, compartilhado por confirmação e expiração. Vínculo único de transação externa, verificação de valor e proteção de ingresso/ledger/comissão continuam obrigatórios. Chamada externa fora do lock.
- Pagamento tardio, divergente e sem referências vai para revisão manual; não reabrir pedido cancelado automaticamente. Conferir estoque antes de qualquer entrega e registrar eventual devolução.
- Ajuste pequeno na página de retorno para enviar referências quando disponíveis e exibir o estado local. Remover promessa de pagamento exclusivamente Pix se a conta não permitir restringir métodos. Manter simulação bloqueada em produção.
- Lista protegida de pedidos pendentes, UNKNOWN e eventos não processados, com consulta/exportação simples; reutilizar painel existente quando possível. Operador responsável confere cada venda no painel InfinitePay. Reprocessamento usa o mesmo fluxo protegido; comprovante enviado pelo comprador não basta.
- Desabilitar no backend a execução automática de saques neste piloto; esconder botão sozinho não basta. Solicitar/devolver/repassar dinheiro pelo operador, com registro externo restrito: pedido, valor bruto, taxa, valor liquidado, beneficiário, data, referência/comprovante, responsável e situação. Sem novo motor financeiro ou tela de liquidação.
- Não apresentar saldo contábil atual como saldo disponível para saque. Não marcar reembolso como concluído ou saque como pago por simples solicitação. Se ajustes contábil/estoque não forem suportados com segurança, registrar pendência e restringir o fluxo atual até conciliação.

### Cartão, liquidação e margem

Antes de habilitar cartão, preencher tabela operacional com Pix, crédito 1x e cada parcelamento permitido: taxa percentual, tarifa fixa, antecipação, quem paga acréscimos, prazo de liquidação, custo de devolução e chargeback. Valores devem vir da conta/proposta aplicável, não de taxa promocional genérica.

Modelo de cálculo para decisão, não cotação: margem de contribuição por pedido = feeCents - custo efetivo do gateway - outros custos variáveis assumidos pela EventFlow. O custo usa a base efetivamente tarifada; não subtrair percentuais de bases diferentes. Se a base do ingresso for R$ 100 e os 8% forem adicionados ao comprador, a venda será R$ 108. Uma taxa HIPOTETICA de 4% sobre R$ 108 custa R$ 4,32, deixando R$ 3,68 dos R$ 8 antes dos demais custos. Se o produtor absorver a comissão, a cobrança seria R$ 100 e o mesmo percentual hipotético custaria R$ 4.

Decidir expressamente quem assume taxas, antecipação e perdas. Se o parcelamento não fechar a conta, desabilita-lo na conta quando suportado ou não ativar esse fluxo até resolver; não presumir que a API permite limitar formas de pagamento.

### Testes obrigatórios do mínimo

1. Compra correta: pagamento verificado, um conjunto de ingressos, crédito e comissão corretos, e check-in sem duplicidade.
2. Webhook falso, valor incorreto e transação de outro pedido não liberam ingresso.
3. Dois callbacks simultâneos e replay, usando PostgreSQL real, não duplicam efeitos.
4. Timeout de criação/verificação e reinício deixam pendência recuperavel; nenhuma nova cobrança automática.
5. Corrida com expiração e pagamento tardio não emitem ingresso sem estoque.
6. Pedido AbacatePay antigo continua roteado corretamente; token do pedido e simulação em produção seguem protegidos.
7. Saque automático bloqueado; conferência, devolução e repasse manuais com evidência e responsável definidos.

Reservar o primeiro dia para decisão e implementação minima; o segundo para validação e correção, sem adicionar funcionalidades. Não usar a estimativa original de 24-40h como compromisso de entrega. Se faltar tempo para esses testes, não ativar.

### Deploy do banco

Substituir db push no start por migrações versionadas no processo de release e start apenas da aplicação. Antes de usar prisma migrate deploy, verificar histórico aplicado, drift e eventuais mudanças feitas anteriormente com db push. O repositório tem migrations, mas isso não prova alinhamento do banco de produção. Ensaiar em copia restaurada, preparar backup e baseline/reconciliação se necessário. Não trocar apenas o comando e executar migrations antigas as cegas.

### Depois do dia 22

Reavaliar necessidade de worker automático, lease, retries, capacidades extensas, reconciliação avançada e novo domínio financeiro. As seções 1-11 abaixo documentam esse desenho ampliado; não são requisito integral do lote de 50 ingressos.

## 1. Decisão proposta

Usar checkout hospedado da InfinitePay como adaptador temporário de cobrança. Manter regras de pedido, precificação, estoque, ingressos e notificações na EventFlow. Introduzir PaymentProvider e um registro de provedores no módulo Payments existente, sem criar microservico.

Selecionar o provedor apenas na criação do pagamento. Consultas, callbacks e conciliação sempre usam o provedor persistido naquele pagamento. Uma troca de configuração afeta somente pedidos novos. Manter o adaptador e o webhook AbacatePay para pedidos antigos.

Esta proposta não entrega o modelo completo de marketplace solicitado anteriormente. Recebimento centralizado ou por organizador é uma decisão operacional pendente. Não ativar vendas de terceiros assumindo split automático. Confirmar com a InfinitePay o enquadramento da EventFlow e a conta recebedora antes da ativação.

## 2. Evidências do projeto

| Area | Local atual | Consequência para a integração |
| --- | --- | --- |
| Pedido e estoque | `apps/api/src/modules/checkout/use-cases/create-checkout.use-case.ts` | Reserva estoque atomicamente, calcula taxa de 8%, cupons e comissoes; fixa PIX e abacate_pay. |
| Criação externa | `apps/api/src/modules/checkout/checkout.service.ts` | Chama gateway depois do commit; qualquer falha cancela pedido e libera estoque. |
| Pagamentos | `apps/api/src/modules/payments/payments.service.ts` | Injeta AbacatePay diretamente; concentra confirmação, ingresso, ledger e e-mail. |
| Consulta pública | `apps/api/src/modules/checkout/checkout.service.ts` | Exige token do pedido e tenta reconciliar pendências com janela de 15 segundos. |
| Webhooks | `apps/api/src/modules/webhooks/` | Parser por provedor, log com chave única e processamento síncrono. |
| Expiração | `apps/api/src/modules/checkout/reservation-expiration.service.ts` | Cancela pedidos pendentes após TTL, padrão 30 minutos; não cancela checkout externo. |
| Banco | `apps/api/prisma/schema.prisma` | Um Payment por Order; provider string; referências opcionais; PaymentLog único por provedor/evento. |
| Financeiro | `apps/api/src/modules/finance/finance.service.ts` | Saques chamam AbacatePay diretamente; saldo usa ledger, sem segregação por custodiante. |
| Reembolso | `apps/api/src/modules/buyer/buyer.service.ts` | Cancela ingresso e libera estoque, registra solicitacao; não devolve dinheiro pelo gateway. |
| Interface | `apps/web/app/checkout/[slug]/page.tsx` | Formulário fixado em PIX; redireciona por checkoutUrl. |
| Retorno | `apps/web/app/checkout/success/page.tsx` | Consulta status a cada 4 segundos; status=paid tenta confirmação simulada. |

O schema ainda tem default de provider=mercado_pago, embora o fluxo atual grave abacate_pay explicitamente. Não reclassificar registros antigos pelo novo default.

## 3. Contrato externo e lacunas

A documentação descreve `POST /links` com handle, items em centavos, order_nsu, redirect_url e webhook_url. A consulta `POST /payment_check` recebe handle, order_nsu, transaction_nsu e slug. O retorno inclui success, paid, amount, paid_amount e capture_method. O webhook de aprovação usa invoice_slug; o redirecionamento usa slug. Recomenda resposta HTTP 200 rapida; informa retentativa para 400. Fonte: [documentação oficial](https://www.infinitepay.io/checkout-documentacao).

Não encontrei nessa documentação contratos de split, recebedores, saque, estorno via API, sandbox dedicado, assinatura de webhook, idempotency key, expiração/cancelamento de link ou consulta somente por pedido. Ausência de documentação não prova indisponibilidade comercial. O exemplo de items tem uma inconsistência textual com itens; homologar payload e resposta reais. Fonte: [documentação oficial](https://www.infinitepay.io/checkout-documentacao).

O artigo oficial descreve checkout com Pix e cartão e configuração de credenciais no painel; verificar se a conta exige configuração adicional, pois o guia técnico público não detalha esse fluxo. Fonte: [integração InfinitePay](https://www.infinitepay.io/blog/integracao-infinitepay).

A central descreve cancelamento pelo aplicativo. Isso não constitui contrato de API para automatizar reembolsos. Fonte: [cancelamento de vendas](https://ajuda.infinitepay.io/pt-BR/articles/6097686-como-funciona-o-cancelamento-de-vendas).

## 4. Abstração proposta

```text
CheckoutService -> PaymentsService -> PaymentProviderRegistry
                                     |-> AbacatePayProvider -> gateway existente
                                     |-> InfinitePayProvider -> cliente HTTP

Webhook/retorno -> verificacao externa -> PaymentsService -> transacao local
                                                           |-> ingressos
                                                           |-> ledger/comissoes
                                                           |-> notificacao apos commit
```

Contrato conceitual, a implementar com DTOs tipados e validação de runtime:

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

- `CreatePaymentCheckout`: identificador local, valor final em centavos, descrição, comprador, URLs e contexto de conta persistido. Não recebe produtos ou clientes proprietários do AbacatePay.
- `CreatedPaymentCheckout`: checkoutUrl e referências externas opcionais. Não exigir transactionId na criação nem inventar um identificador remoto usando o ID local.
- `VerifyPaymentInput`: referências persistidas e, quando necessário, pistas do callback. Adaptador traduz para o formato externo.
- `VerifiedProviderPayment`: status, valor, método efetivo, referências e evidência de verificação. Status desconhecido não vira PENDING automaticamente nem regride um pagamento aprovado.
- Capabilities expressam checkout hospedado, métodos, consulta com/sem referência de transação e operações comprovadamente disponíveis. Recursos não documentados permanecem indisponíveis no adaptador.
- `PaymentProviderRegistry.forNewPayment()` resolve a configuracao; `get(payment.provider)` resolve registros existentes. ID desconhecido falha explicitamente.
- Parsers e autenticação de webhook ficam em adaptadores de entrada, separados das regras de negócio. Implementações de cobrança não escrevem diretamente no Prisma nem emitem ingressos.
- Reembolso, recebedores, split e payout merecem contratos separados quando houver um provedor com suporte confirmado; não criar métodos vazios que retornam sucesso.

## 5. Persistência e compatibilidade

Manter Payment e Order; não introduzir múltiplas tentativas pagáveis por pedido nesta etapa. Uma tentativa ambígua não autoriza gerar outro checkout automaticamente.

Migração aditiva proposta:

- Payment.checkoutUrl opcional, para recuperar o link existente.
- Payment.providerAccountRef opcional: snapshot da conta/handle utilizada. Não armazenar credenciais neste campo.
- Payment.providerMetadata JSON opcional e versionado, validado por adaptador, para valores efetivamente pagos, parcelas e referências adicionais.
- Payment.checkoutCreationState opcional: CREATING, READY, UNKNOWN, FAILED; claim com prazo para concorrência. Desacoplar criação externa do status financeiro.
- PaymentLog: campos de tentativas, próxima tentativa, claim/lease, último erro resumido e revisão necessária. Aproveitar o log como inbox durável.
- Restrição única para transação externa por provedor e conta; verificar duplicatas antes de aplicar. Não usar dedupe do webhook como única proteção contra reutilização de transação.

Preservar providerRef, checkoutId, billId e transactionId atuais. Para InfinitePay, invoice_slug pode preencher checkoutId após validacao; transaction_nsu preenche transactionId. Não inferir slug pela URL sem contrato confirmado. Mapear registros AbacatePay existentes no adaptador sem renomear campos de forma destrutiva.

Registrar explicitamente o provider na mesma transação que cria Order/Payment. A seleção não deve mudar entre criar o pedido e chamar o gateway. Backfill de conta, se necessário, deve usar evidência operacional; nunca atribuir a conta atual indiscriminadamente a pagamentos históricos.

Preservar orderId, orderAccessToken, status e checkoutUrl da resposta pública. DTOs do frontend/SDK só recebem campos adicionais quando necessários. Inspecionar consumidores de Payment.method antes de permitir null; sugestão inicial: campo adicional de método confirmado, com o método antigo tratado como solicitado até a verificação.

O start atual executa prisma db push. Preparar SQL revisável e testar em copia local/staging antes do deploy, sem depender de alterações destrutivas automáticas. Fazer rollout de schema antes do código consumidor.

## 6. Fluxos a implementar

### Criação

1. Validar provedor e configuração antes de reservar estoque.
2. Criar pedido e pagamento com provedor/conta fixos, usando os cálculos atuais.
3. Obter claim exclusivo de criação e reutilizar checkoutUrl quando READY. Rejeitar criação para pedido pago, cancelado ou estornado.
4. No adaptador, representar inicialmente o pedido como item agregado pelo totalCents. Essa decisão preserva exatamente desconto e taxa sem arredondamento por ingresso. Tratar total zero em fluxo interno de gratuidade, sem tentar cobrar zero.
5. Chamar a API fora da transação de banco; timeout finito. Retry de consulta pode usar backoff; retry de criação exige evidência de idempotência externa.
6. Persistir resultado antes de entregar URL. Falha definitiva permite compensação única; timeout, resposta inválida ou falha ao persistir após sucesso remoto deixam estado UNKNOWN, com revisão/recuperação, sem novo link automático.
7. Definir contrato de resposta para UNKNOWN que permita consultar o pedido e não induza o comprador a repetir a compra cegamente.

### Confirmação

1. Endpoint dedicado `POST /webhooks/infinitepay`, com DTO, limite de payload e resposta explicita 200. Nest retorna 201 em POST por padrão: usar HttpCode(200).
2. Segredo aleatório na URL pode servir como barreira adicional se a plataforma preservar a query; homologar isso. Redigir logs para não guardar segredo nem token público do pedido. Não tratar essa barreira como prova de pagamento.
3. Persistir evento na inbox antes de responder; payload não verificado nunca altera pagamento. Dedupe por provedor, conta, tipo de evento e transacao; conservar evidências divergentes em vez de sobrescrever evento já processado.
4. Worker com claim no banco consulta o provedor. Reaproveitar o padrão de serviço periódico já existente, com lease persistido para múltiplas instâncias e recuperação após reinício. Enfileirar em BullMQ pode acelerar processamento, mas inbox continua fonte durável e recuperável.
5. Validar pagamento positivo, pedido, conta, referências e valor contra dados persistidos. Confirmar na homologação que payment_check realmente vincula todos os identificadores enviados: testar uma transação real do pedido A contra pedido B. Sem essa garantia, liberar ingressos automaticamente fica bloqueado.
6. Comparar valor base confirmado ao totalCents; guardar paid_amount separadamente. A semântica de taxas/parcelamento precisa ser homologada; diferença não deve alterar a comissão EventFlow por inferência.
7. Executar confirmação e fulfillment em uma transação local serializada por pedido. Marcar inbox processada atomicamente com os efeitos de negócio. E-mail ocorre depois do commit e continua com dedupe/retry existente.
8. Eventos inválidos, divergentes ou sem referências suficientes ficam registrados para revisão. Falhas temporárias são repetidas com backoff; nunca confirmar por timeout ou apenas pelo corpo do webhook.

### Retorno e conciliação

- Acrescentar endpoint autenticado pelo token do pedido para receber pistas do retorno. O frontend envia apenas campos permitidos, e o backend consulta o gateway antes de persistir referências como verificadas.
- `status=paid` e parâmetros da URL nunca aprovam uma venda real. Separar retorno real do caminho de simulação e manter bloqueio de simulação em produção.
- Atualizar a página de sucesso para encaminhar as referências e continuar consultando o estado local. Limitar chamadas externas por pagamento, inclusive quando o navegador repete a URL.
- Sem referências necessárias, retornar insufficient_reference; não produzir polling externo inútil. Se webhook e retorno faltarem, a recuperação automática pode ser impossível com o contrato público: disponibilizar fila de pendências e procedimento operacional de conciliação.
- Mostrar meio efetivamente confirmado. A UI hoje fixa PIX; para InfinitePay, a escolha deve ocorrer no checkout hospedado e a EventFlow não deve prometer exclusividade de PIX sem parâmetro confirmado.

## 7. Correções exigidas para a troca

### Concorrência

Hoje verificações como contar ingressos e procurar ledger antes de criar não garantem unicidade entre duas transações simultâneas. A leitura inicial de status também não bloqueia concorrentes. Os testes existentes demonstram replay sequencial, não concorrência real.

Usar lock por pedido dentro da transação, com ordem de locks comum entre pagamento, cancelamento e expiração. Revalidar status após adquirir o lock. Alternativa válida e transação Serializable com retries limitados. Comissões, ledger, estoque e ingressos devem mudar uma única vez. Nenhuma chamada externa deve manter o lock aberto.

### Expiração e pagamento tardio

Não manter a suposição de que cancelar a reserva local cancela a cobrança externa. Confirmar prazo/invalidação do link com o provedor. Aumentar o TTL apenas reduz a frequência do problema.

Proposta: registrar recebimento externo tardio separadamente quando o pedido já estiver cancelado, sem forcar CANCELED -> PAID nem emitir ingresso sem estoque. Criar pendência operacional durável para devolução ou atendimento com disponibilidade revalidada. O comprador deve ver que o pagamento está em análise, em vez de ficar preso em "aguardando pagamento". Essa pendência precisa aparecer para a equipe, com responsável e evidência.

Conciliar antes da expiração quando houver referências ajuda, mas não elimina a corrida. O mesmo lock deve proteger expiração e confirmação. Testar explicitamente recebimento depois de liberar o último ingresso.

### Saques, estornos e saldo

- Desacoplar aprovação de saque da chamada fixa ao AbacatePay antes de receber pela InfinitePay. O saldo atual mistura origens e não justifica transferir fundos por outra conta automaticamente.
- Para a fase temporária, usar liquidação manual auditada: solicitação, verificação de saldo realmente liquidado, transferência pelo operador e registro de comprovante/referência. Nunca marcar PAID só por aprovação administrativa. Restringir permissões e evitar duplo processamento.
- Solicitar reembolso e concluir devolução são estados distintos. Criar acompanhamento durável de solicitacoes; registrar conclusão financeira apenas após comprovação externa.
- Ao concluir estorno, compensar ledger/comissões uma única vez e evitar segunda liberação de estoque quando o ingresso já foi cancelado individualmente. O fluxo atual de cancelamento terminal não cria lançamento compensatório de ledger.
- Não oferecer reembolso parcial automático: o status atual REFUNDED e de pagamento inteiro. Se houver devolução parcial manual, registrar valor e ingresso afetado separadamente.
- Separar saldo contábil de valor disponível para saque. Não estimar taxa do gateway pela diferença entre amount e paid_amount.

Essas medidas cobrem riscos presentes nas áreas diretamente afetadas. Split, KYC, subcontas, reserva por evento e repasse automático ficam para o provedor definitivo e exigirão extensão do domínio financeiro, não apenas troca do adaptador.

## 8. Sequência de entrega

| Etapa | Entrega verificável | Condição para avançar |
| --- | --- | --- |
| 1 | Confirmar conta, enquadramento, contratos e payload real | Identificadores vinculados corretamente e operação temporária definida |
| 2 | PaymentProvider, registry e wrapper AbacatePay | Fluxo atual e contratos públicos passam sem troca de provedor |
| 3 | Migração aditiva, claim e confirmação serializada | Concorrência, replay e expiração cobertos em banco real |
| 4 | InfinitePay, inbox, worker e retorno | Confirmação somente após verificação externa |
| 5 | UI de pagamento, pendências, saque/estorno manual auditado | Operação não aciona conta errada nem simula devolução |
| 6 | Homologação e ativação controlada | Compra, ingresso, check-in, devolução e rollback exercitados |

Estimativa de planejamento: 24-40 horas de engenharia concentrada, mais tempo externo de habilitação/homologação. O prazo de 48 horas é apertado; não é possível garantir ativação pela leitura da documentação. O adaptador isolado e pequeno, mas não representa a entrega inteira. Se contratos essenciais não forem confirmados, concluir a abstração e manter InfinitePay desativada.

## 9. Configuração e rollout

Variáveis propostas: PAYMENT_PROVIDER (definir `infinite_pay` no ambiente de vendas), INFINITEPAY_HANDLE, INFINITEPAY_WEBHOOK_SECRET, INFINITEPAY_BASE_URL, PAYMENT_WEBHOOK_WORKER_ENABLED e PAYOUT_MODE. Usar APP_URL/API_URL existentes. Validar configuração por provedor ativo e manter credenciais antigas para conciliação histórica.

1. Publicar schema aditivo e abstração ainda usando AbacatePay.
2. Validar fixtures locais, regressão e staging. Simulação local não e sandbox oficial.
3. Homologar com conta real habilitada, transações controladas e devolução comprovada.
4. Ativar para evento piloto por seleção server-side; confirmar métricas e atendimento das pendências.
5. Expandir somente após o ciclo completo. Monitorar criação ambígua, atraso de webhook, divergência de valor, pagamento tardio e repetições.
6. Reversão altera provedor apenas para novos pedidos. Continuar workers/webhooks dos dois provedores e preservar schema. Se AbacatePay ainda não estiver operacional, rollback significa suspender novos checkouts, não fingir que existe fallback funcional.

## 10. Verificação

Baseline executada nesta análise: 7 suites, 39 testes aprovados (payments, gateway AbacatePay, checkout, use case, webhooks e finance). São testes existentes com mocks; não comprovam integração externa ou segurança sob concorrência. E2E existente inspecionado, mas não executado; ele usa webhook AbacatePay e deve permanecer como regressão.

Adicionar testes de:

- Contrato dos dois adaptadores e roteamento de pedido antigo após mudar PAYMENT_PROVIDER.
- Valor com cupom, taxa absorvida, taxa repassada, vários ingressos, centavos e total zero.
- Método confirmado diferente do inicialmente solicitado.
- Duplo clique, timeout externo, resposta inválida e falha de persistência depois de criar checkout.
- Webhook falso, segredo inválido, transação de outro pedido/conta, valor divergente e replay.
- Webhook antes de persistir resposta de criacao; retorno antes do webhook; retorno ausente.
- Worker encerrado após claim, retry após falha e duas instâncias disputando evento.
- Confirmações simultâneas em PostgreSQL real: um conjunto de ingressos, um crédito e uma comissão.
- Corrida de expiração/confirmação, pagamento tardio e estoque indisponível.
- Reembolso de ingresso já cancelado, ledger compensatório e registro manual sem dupla devolução.
- Saque sem chamada ao gateway errado, sem saldo liquidado e com duplo processamento.
- Token de pedido, isolamento de tenant, simulação bloqueada em produção e retorno adulterado.
- E2E por provedor: pedido -> checkout -> verificação -> ingresso -> e-mail -> check-in -> rejeição de check-in duplicado.

## 11. Critério de conclusão

A integração está pronta quando vendas novas usam o provedor escolhido, pagamentos históricos continuam conciliáveis, nenhuma notificação não verificada emite ingressos, concorrência não duplica efeitos, pendências tardias/ambíguas são recuperáveis e saque/reembolso refletem movimentação financeira comprovada. A abstração reduz o acoplamento técnico, mas não transforma um checkout simples em infraestrutura de marketplace.
