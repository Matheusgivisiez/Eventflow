# Confirmação de compra por e-mail (Bloco B do plano de compra como convidado)

## O problema que existia

O e-mail de compra aprovada nunca era enviado: `NotificationsService.send` apenas
gravava uma linha em `NotificationLog` e escrevia um log. Pior, o disparo ficava
em `WebhooksService`, fora do funil de pagamento — então uma compra confirmada por
reconciliação com o provedor ou por confirmação simulada não gerava notificação
nenhuma, mesmo quando o ingresso era emitido normalmente.

## Onde a confirmação passou a ser decidida

`PaymentsService.updateStatus` já era o funil único de `PENDING -> PAID`: webhook,
`reconcileProviderStatus`, `confirmSimulation` e o reparo feito em
`BuyerService.reconcileOwnedOrders` passam todos por ele. O que faltava era a
notificação estar **dentro** desse funil.

`dispatchPurchaseConfirmed` é chamado ali, **depois** do commit da transação:

- SMTP nunca segura uma transação de banco aberta;
- uma indisponibilidade do provedor de e-mail não desfaz um pagamento aprovado —
  o método não propaga exceção, apenas registra.

`WebhooksService` não conhece mais o `NotificationsService`.

## Idempotência

`NotificationLog` virou uma fila persistente: `status`, `attempts`, `lastError`,
`deliveredAt` e `dedupeKey` único.

A chave da confirmação de compra é `purchase-confirmed:<orderId>`. Com isso:

- webhook reenviado pelo provedor não gera segundo e-mail;
- reconciliação correndo junto com o webhook não gera segundo e-mail;
- uma corrida entre dois processos é resolvida pelo índice único (violação
  `P2002` é tratada como duplicidade, não como erro).

Uma entrega que falhou (`status = FAILED`) é retentada na próxima vez que aquele
pedido passar pelo funil, até `MAX_DELIVERY_ATTEMPTS`. **Não existe worker de
retentativa automática**: a retentativa depende de um novo evento sobre o pedido.
Se isso não for suficiente, o índice `(status, sentAt)` já permite varrer as
falhas em um job futuro.

## O que o e-mail contém

Nome do comprador, evento, data, código do pedido, quantidade de ingressos,
botão para a página segura do pedido e um botão secundário para criar conta.

Deliberadamente **não** contém CPF, telefone, assinatura do ingresso nem o payload
do QR Code: a mensagem atravessa servidores que não controlamos. O link aponta
para a página do pedido, que aplica as regras de liberação de QR do evento.

Formato do link: `/checkout/success?orderId=<id>&accessToken=<token>`.

## Página de sucesso

Convidado não é mais redirecionado para `/me/ingressos` — o redirecionamento
levava ao login e tirava da frente o ingresso recém-pago. Agora o convidado
permanece na página, com o aviso de que o link também foi enviado por e-mail e
os caminhos "Criar conta" (com o e-mail preenchido) e "Já tenho conta".

O preenchimento do e-mail no cadastro é conveniência, não prova: as compras
antigas só aparecem depois da confirmação do endereço (ver
`verificacao-de-email.md`).

Usuário autenticado mantém o comportamento atual, com a contagem regressiva.

## Configuração

- `PURCHASE_EMAIL_ENABLED` (padrão `true`) desliga apenas o e-mail de compra sem
  derrubar o SMTP, do qual a recuperação de senha também depende.
- Sem SMTP configurado o envio é registrado como `SKIPPED`, com aviso em log.
  Configure SMTP e SPF/DKIM/DMARC antes de considerar a funcionalidade no ar.

## Métricas úteis para acompanhar

Consultas diretas em `NotificationLog`: contagem por `status`, falhas recentes
(`status = 'FAILED'` ordenado por `sentAt`) e pedidos pagos sem linha
`purchase-confirmed:` correspondente.
