# Compras em andamento: retomada segura do pagamento

## Estado da implementação local

O fluxo de retomada foi construído no código e está desligado por padrão. Não houve migração aplicada a banco nem deploy. Para experimentá-lo em ambiente isolado, aplicar a migration `20261007120000_pending_checkout_resume` nesse ambiente, configurar `PENDING_PURCHASES_ENABLED=true` na API e `NEXT_PUBLIC_PENDING_PURCHASES_ENABLED=true` no web, reiniciar os serviços e criar um novo pedido InfinitePay. A URL de pedidos anteriores não foi persistida e não pode ser recuperada por esse recurso.

O incremento inclui a seção de compras em andamento para contas, um atalho para o último pedido do visitante no mesmo navegador e a retomada pela página do pedido. O cancelamento imediato não faz parte da implementação.

## Decisão

Adicionar uma experiência de **compras em andamento** ao lado de “Meus ingressos”, sem transformar a área em carrinho e sem alterar a reserva, o webhook ou a emissão de ingressos. O primeiro incremento permite localizar um pedido pendente e voltar ao mesmo checkout externo. A reserva continua vencendo pelo prazo configurado na API.

Não oferecer, neste incremento, um botão que prometa cancelar imediatamente e devolver o estoque. O Checkout Integrado da InfinitePay documenta a criação do link, `payment_check` e webhook, mas não documenta uma operação de invalidar o link. Liberar estoque enquanto ele ainda aceita pagamento pode produzir pagamento sem ingresso quando o lote se esgota. A rotina atual de pagamento tardio registra exatamente esse caso para tratamento manual.

Fonte: <https://www.infinitepay.io/checkout-documentacao> (consultada em 07/10/2026).

## Estado atual que a implementação deve preservar

- O pedido nasce `PENDING` com `stockReservedAt`, e o contador `TicketType.sold` sobe para reservar o estoque.
- A API cancela reservas vencidas em varreduras de um minuto; o prazo padrão é 60 minutos, configurável por `ORDER_RESERVATION_TTL_MINUTES`.
- O checkout recebe a URL externa da InfinitePay e redireciona o navegador. A URL não é persistida para retomada. O navegador guarda apenas `eventflow:last-checkout`, com o identificador e o token do último pedido.
- `GET /buyer/tickets` consulta ingressos emitidos. Pedidos pendentes não aparecem em “Meus ingressos”.
- O webhook e a reconciliação confirmam o pagamento; o retorno pelo navegador não é prova de pagamento.
- O link do provedor pode continuar acessível depois do vencimento da reserva. A reconciliação tenta reativar o pedido pago fora do prazo se houver estoque; se não houver, gera o caso “PAGO SEM ESTOQUE”.

## Experiência proposta

Na área `/me/ingressos`, inserir uma seção independente **Compras em andamento**, antes das abas de ingressos emitidos. Não misturar `PENDING` com ingresso ativo ou cancelado.

Cada cartão mostra nome e data do evento, lote e quantidade, valor total, estado **Aguardando pagamento** e horário exato até o qual o ingresso está reservado. CTA principal: **Continuar pagamento**. Texto de apoio: “Seu ingresso fica reservado até HH:mm. O ingresso é emitido após a confirmação do pagamento.” Usar contagem regressiva como orientação visual, sincronizada com um `expiresAt` fornecido pelo servidor; o servidor decide o estado final.

Quando o prazo passar, trocar o CTA por **Reserva encerrada** e oferecer **Ver ingressos disponíveis**. Ao confirmar o pagamento, remover o cartão dessa seção e deixar o ingresso aparecer no fluxo atual. Em mobile, usar um cartão por linha, hierarquia clara entre evento, prazo e ação, e botão de largura total. Manter texto, foco de teclado e atualização do estado acessíveis; não depender apenas da cor ou do cronômetro.

Para compras sem conta, usar a página existente `/checkout/success` e o token do último pedido guardado no navegador como ponto de retomada. Não ampliar o acesso por e-mail não verificado. Uma compra feita como visitante em outro dispositivo exigiria um fluxo posterior de recuperação por e-mail verificado.

## Contratos isolados

### Persistência aditiva

Adicionar `Payment.checkoutUrl String?` por migration aditiva. Depois de gravar as referências obrigatórias em `createProviderPreference`, gravar a URL da InfinitePay em uma operação opcional quando a flag estiver ativa. Uma falha nessa segunda gravação não derruba o checkout original. A URL não deve ser recriada a cada clique em “Continuar pagamento”: isso geraria múltiplos links para o mesmo pedido. Validar que é HTTPS e pertence ao domínio da InfinitePay antes de gravar e antes de devolver ao navegador. Um pedido legado sem URL continua válido, mas não oferece retomada.

### Leitura para conta autenticada

`GET /buyer/pending-orders` retorna uma lista enxuta de pedidos `PENDING` ligados ao `userId` da sessão ou, para pedidos de visitante, ao e-mail **verificado** da conta. Cada item inclui `id`, evento, lote/quantidade, `totalCents`, `status`, `reservedUntil` calculado no servidor e `canResume`. Não retornar `checkoutUrl`, CPF, token de acesso ou objetos Prisma completos. Usar `Cache-Control: no-store`, paginação e limite de resultados.

### Retomada individual

`POST /checkout/order/:orderId/resume`, com `accessToken` no corpo para visitante, ou autenticação da conta que tem direito ao pedido. Responder `{ checkoutUrl }` somente se o pedido ainda estiver `PENDING`, reservado, antes de `reservedUntil`, com link persistido e de domínio permitido. Antes da resposta, tentar a reconciliação existente quando houver referências suficientes, reler o pedido e recusar a retomada se o status mudou. Respostas fechadas: `404` para pedido inacessível; `409` para pago, expirado, cancelado ou sem link retomável; `503` se não for possível decidir com segurança. Aplicar limitação de taxa e `Cache-Control: no-store`.

O frontend consulta a lista em um componente próprio e chama `resume` apenas no clique. Ele então navega para a URL devolvida. Invalida as consultas de pedidos e ingressos ao voltar da InfinitePay. A página de sucesso continua a tratar aprovação e QR Code pelo fluxo atual.

## Fronteiras e regras de concorrência

- A nova consulta não altera estoque nem estados de pedido.
- `resume` não cria pedido, não reserva estoque, não gera outro link e não marca pagamento como aprovado.
- O estado e o prazo são rechecados no servidor no momento do clique; o cronômetro visual não decide nada.
- Se pagamento, expiração e retomada ocorrerem quase juntos, a transação existente de pagamento/expiração decide o resultado. O clique pode retornar `409` e atualizar o cartão.
- Falha ao salvar a URL não deve cancelar um checkout já criado pelo provedor; registrar o erro e manter o checkout original. A retomada ficará indisponível naquele pedido. A implementação deve preservar atomicamente as referências de pagamento que já são gravadas hoje.
- Pedidos gratuitos, pagos, reembolsados e cancelados nunca aparecem como compra em andamento.

## Cancelamento por iniciativa do comprador

Tratar como etapa posterior. Antes de liberar estoque no clique, obter da InfinitePay confirmação contratual de invalidação do link ou uma operação de cancelamento que impeça pagamento posterior. Se isso existir, implementar no mesmo caminho transacional/idempotente usado para cancelamento e expiração, com disputa contra o webhook. Se não existir, um botão “Desistir da compra” só pode ocultar o cartão para o comprador e explicar que a reserva termina no horário mostrado; não deve prometer devolução imediata do ingresso.

Não reduzir o TTL de 60 minutos neste projeto. Primeiro medir o tempo real de pagamento, abandono, expiração e pagamentos tardios. Depois decidir o prazo com dados.

## Entrega e verificação

1. Concluído no código: migration aditiva, persistência opcional da URL, módulo próprio de listagem/retomada e interface atrás de flags desligadas por padrão.
2. Concluído em testes locais: dono da conta, visitante com token, outro comprador, reserva expirada, URL externa inválida, pagamento confirmado durante a retomada e falha da persistência opcional.
3. Antes de ativar fora do ambiente local: aplicar a migration no ambiente escolhido, testar o percurso com a InfinitePay e verificar regressões de checkout, expiração e webhook. Nenhuma mudança deve ser ativada em produção durante o lote no escuro.
4. Depois do lote: avaliar com dados as taxas de retomada, falha, expiração e `eventflow_late_payments_total` antes de considerar cancelamento manual ou alteração do TTL.

## Arquivos de referência

- `apps/api/src/modules/checkout/use-cases/create-checkout.use-case.ts`
- `apps/api/src/modules/checkout/reservation-expiration.service.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/payments/infinite-pay.gateway.ts`
- `apps/api/src/modules/buyer/buyer.service.ts`
- `apps/web/app/checkout/[slug]/page.tsx`
- `apps/web/app/checkout/success/page.tsx`
- `apps/web/app/me/(profile)/ingressos/page.tsx`
