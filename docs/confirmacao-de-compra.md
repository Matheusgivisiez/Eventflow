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

A reivindicação é **uma única escrita atômica** que faz três coisas juntas:

- move a linha para `PENDING`, que é o estado *em voo*, venha ela de onde vier;
- grava `claimedAt`, que inicia o lease;
- incrementa `attempts`, que serve de token de compare-and-swap.

As três são necessárias e cobrem coisas diferentes. O lease cobre quem chega
**depois**; o compare-and-swap cobre quem lê **ao mesmo tempo**; e mover para
`PENDING` é o que faz o lease valer para qualquer origem.

A chave única impede uma segunda linha, nunca um segundo envio.

Uma versão anterior media o abandono a partir de `sentAt`. Como `sentAt` nunca
muda, uma linha antiga parecia abandonada para sempre: o processo A assumia a
entrega e o processo B, chegando um segundo depois, assumia de novo e enviava o
e-mail duas vezes. O `claimedAt` existe exatamente por isso.

Uma entrega que falhou (`status = FAILED`) é retentada assim que aquele pedido
voltar ao funil, até `MAX_DELIVERY_ATTEMPTS`, sem esperar o lease: uma linha
`FAILED` não tem dono, porque a tentativa anterior já terminou e escreveu o
resultado. Uma linha `PENDING` com o lease vencido (5 minutos) é tratada como
abandonada e também volta a ser entregável.

Houve uma versão em que a retentativa de uma linha `FAILED` a mantinha `FAILED`
durante a chamada ao SMTP. Como o lease só se aplica a `PENDING`, aquela entrega
em voo ficava invisível: um segundo processo lia a linha, não via dono e enviava
de novo. Por isso a reivindicação move o estado, e não só carimba a data.

## Retentativa automática

`NotificationRetryService` varre a cada 2 minutos as confirmações de compra
presas — `FAILED`, ou `PENDING` com o lease vencido — dos últimos 7 dias, em lotes
de 50, e reprocessa cada uma por
`PaymentsService.dispatchPurchaseConfirmed`.

Passar pelo funil é o ponto: o worker decide **quando** tentar de novo, nunca
**se** é seguro enviar. Todas as travas continuam valendo — a flag
`PURCHASE_EMAIL_ENABLED`, o pedido ter de estar `PAID`, a chave de deduplicação,
o lease e o teto de tentativas.

Uma passada por vez: um SMTP lento não empilha execuções sobrepostas. Com mais de
uma instância da API, o lease e o compare-and-swap resolvem a concorrência entre
os workers — é o mesmo caminho de qualquer outro chamador.

Desligável por `NOTIFICATION_RETRY_ENABLED`. O intervalo usa `setInterval` com
`unref()`, o mesmo padrão do `ReservationExpirationService`.

## O que o e-mail contém

Nome do comprador, evento, data, código do pedido, quantidade de ingressos,
botão para a página segura do pedido e um botão secundário para criar conta.

Deliberadamente **não** contém CPF, telefone, assinatura do ingresso nem o payload
do QR Code: a mensagem atravessa servidores que não controlamos. O link aponta
para a página do pedido, que aplica as regras de liberação de QR do evento.

Formato do link: `/checkout/success?orderId=<id>&accessToken=<token>`.

## Contrato público

`POST /notifications` continua respondendo
`{ id, status: "QUEUED", channel, event, recipient }`. O método `enqueue()` existe
só para preservar esse formato; chamadas internas usam `send()`, que devolve o
estado real da entrega. Um canal sem transporte (WhatsApp, hoje) grava a linha
como `PENDING`, que é exatamente o que a rota sempre chamou de `QUEUED`.

## Página de sucesso

Convidado não é mais redirecionado para `/me/ingressos` — o redirecionamento
levava ao login e tirava da frente o ingresso recém-pago. Agora o convidado
permanece na página, com os caminhos "Criar conta" (com o e-mail preenchido) e
"Já tenho conta".

A página **não afirma** que o e-mail foi enviado: `GET /checkout/order/:id` passou
a devolver `confirmationEmailStatus` (campo aditivo, opcional) e só o valor `SENT`
produz "Enviamos este link para você". Em qualquer outro estado — `FAILED`,
`SKIPPED` por falta de SMTP, `PENDING` ou API antiga — a página pede que o
comprador salve o endereço. Pelo mesmo motivo, o backup do checkout no
`localStorage` só é apagado quando o link é reproduzível pela URL ou o envio foi
confirmado.

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
