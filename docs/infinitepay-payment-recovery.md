# Confirmação e recuperação de pagamentos InfinitePay

O webhook de aprovação documentado em https://www.infinitepay.io/checkout-documentacao
traz `order_nsu`, `invoice_slug` e `transaction_nsu`, mas não o campo `paid` da
resposta de `payment_check`. A notificação deve disparar essa consulta e somente
o status e o valor confirmados pelo provedor podem liberar os ingressos.

## Correção

- Notificações com as referências oficiais seguem pela reconciliação existente.
  O endpoint responde `{ "success": true }` somente após processamento bem-sucedido.
- Consulta inconclusiva mantém o log sem processamento e responde HTTP 400 para
  permitir nova tentativa da InfinitePay. Notificação incompleta não rebaixa um
  pagamento já confirmado.
- O checkout informa sua origem. O servidor aceita somente a origem configurada
  ou, em produção Eventflow, os dois domínios HTTPS exatos com e sem `www`.
  Isso preserva cookies e localStorage do comprador no retorno. URLs arbitrárias,
  inclusive previews não configurados, não recebem o token do pedido.
- Publicar a API antes do frontend: a API antiga rejeita campos extras no DTO.
  Links de pagamento criados antes da atualização conservam seu retorno antigo.

## Investigar uma compra anterior

1. Localizar o pedido e os horários em Cloud Logging. HTTP 200 do webhook prova
   recebimento HTTP, não conciliação financeira. Um log processado como PENDING
   pela versão anterior também não prova falta de pagamento.
2. Consultar `PaymentLog` no banco de produção usando o ID do pedido; selecionar
   apenas os campos necessários, sem exportar payload completo ou tokens:

```sql
-- Substitua :order_id por parâmetro vinculado no cliente SQL.
SELECT id, "createdAt", "processedAt", status,
       payload->>'order_nsu' AS order_nsu,
       payload->>'invoice_slug' AS invoice_slug,
       payload->>'transaction_nsu' AS transaction_nsu,
       payload->>'capture_method' AS capture_method,
       payload->>'amount' AS amount,
       payload->>'paid_amount' AS paid_amount
FROM "PaymentLog"
WHERE provider = 'infinite_pay'
  AND ("orderId" = :order_id OR payload->>'order_nsu' = :order_id)
ORDER BY "createdAt";
```

3. Conferir cada transação na conta recebedora da InfinitePay. Se não houver
   referência do Pix, localizar pelo horário, valor e identificador EndToEnd do
   comprovante detalhado. Notificação bancária isolada não permite essa correlação.
4. Para pedido pendente, confirmar no `payment_check` as referências, o pedido e
   os valores antes de reprocessar pelo fluxo normal de pagamentos. Revisar
   estoque em caso de pedido expirado; não usar UPDATE manual para marcar PAID.
5. Se o cartão já confirmou o pedido e existir outro Pix liquidado, preservar as
   duas referências e tratar a cobrança excedente na conta recebedora. Não
   sobrescrever a transação do cartão, emitir ingresso adicional ou presumir
   estorno automático. A aplicação não controla a troca de método dentro da
   página hospedada pela InfinitePay.

## Validação de produção ainda necessária

Após publicar, acompanhar uma compra Pix autorizada até webhook, consulta ao
provedor, ingresso, e-mail e área Meus Ingressos. Validar retorno autenticado nos
dois domínios. Os testes automatizados usam provedores simulados e não substituem
essa conferência nem a conciliação da compra anterior.
