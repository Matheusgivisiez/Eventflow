# Teste de carga - abertura de lote

Simula o "rush" do momento em que um lote de ingresso abre, pra achar
gargalo e confirmar que o estoque nunca vende mais do que existe
(oversell) sob concorrencia real.

## Antes de rodar

1. Instale k6: `brew install k6` (Mac) ou veja https://k6.io/docs/get-started/installation/
2. Crie um evento e tenant DESCARTAVEIS so pra teste (nunca use o evento
   real da Hallowparty). Pode reaproveitar o padrao usado no teste de
   11/09 (tenant "Load Test Co", evento com um lote pequeno tipo o real).
3. Confirme no ambiente alvo:
   - `PAYMENT_SIMULATION_ENABLED=true` (senao o teste tenta cobrar de
     verdade no gateway).
   - Auto-deploy do Render PAUSADO / combinado pra nao dar push durante
     a janela do teste. Deploy no meio invalida o resultado (foi o que
     aconteceu no teste de 11/09 - a instancia reiniciou ~10x).

## Rodando

```bash
k6 run infra/loadtest/checkout-launch.js \
  -e BASE_URL=https://eventflow-ctdc.onrender.com/api \
  -e EVENT_SLUG=slug-do-evento-de-teste \
  -e TICKET_TYPE_NAME="Lote Promocional" \
  -e LOT_QUANTITY=50 \
  -e BUYERS=150
```

`BUYERS` = quantas pessoas tentam comprar nessa onda, cada uma no maximo
duas vezes (uma tentativa + um retry se cair em 409). Comece em 3x o
tamanho do lote.

**Atencao ao rate limit**: a rota de checkout tem `@Throttle` de 300
requisicoes/minuto POR IP. Rodando o k6 de uma unica maquina, todo mundo
sai do mesmo IP - se `BUYERS` passar de ~280, voce mede o rate limiter,
nao o checkout (foi o que aconteceu no primeiro teste: 3134 de 3135
requisicoes voltaram 429 porque o script antigo ficava re-tentando em
loop). Pra testar volumes maiores que isso de forma limpa, precisa de
origem distribuida (varias maquinas ou um servico de load-test na nuvem).

## Depois de rodar

1. Olhe o resumo do k6 no terminal: `checkout_success` nunca pode passar
   de `LOT_QUANTITY`. Se passar, e bug critico de oversell.
2. Confira no banco (Neon):
   ```sql
   SELECT count(*) FROM "Order" o JOIN "OrderItem" oi ON oi."orderId" = o.id
   WHERE oi."ticketTypeId" = '<id-do-lote-de-teste>' AND o.status IN ('PAID','PENDING');
   ```
3. Olhe as metricas do Render (CPU, memoria, latencia) e do Neon
   (active_connections) na janela do teste, pra achar o gargalo real
   (API ou banco).
4. Apague o tenant/evento de teste depois. Nunca deixe lixo de teste no
   ambiente que vai vender ingresso de verdade.

## Cenario que mais importa

O lote real que abre primeiro (Lote Promocional: R$45, 50 ingressos) e
pequeno. O risco nao e volume sustentado, e todo mundo tentando comprar
o mesmo ingresso escasso no mesmo segundo. Por isso o script sobe pra
`PEAK_VUS` em 5 segundos (nao gradual) - e o cenario real de "abriu a
venda, todo mundo aperta comprar".
