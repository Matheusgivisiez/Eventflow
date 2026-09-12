/**
 * Teste de carga do "rush" de abertura de lote.
 *
 * Cenario: N compradores tentando comprar ao mesmo tempo um lote com estoque
 * limitado (ex: Lote Promocional = 50 ingressos). Mede se o checkout aguenta
 * o pico, se ninguem trava, e principalmente se o numero de pedidos PAGOS
 * nunca ultrapassa o estoque do lote (oversell).
 *
 * NUNCA rode isso contra o evento real (Hallowparty). Rode contra um evento
 * descartavel criado so para o teste (mesmo padrao usado no teste de
 * 11/09: tenant "Load Test Co", eventos "A20"/"B50"/"OVERSELL" etc).
 *
 * Requisitos antes de rodar:
 *  - PAYMENT_SIMULATION_ENABLED=true no ambiente alvo (senao vai tentar
 *    cobrar de verdade no gateway).
 *  - Auto-deploy do Render PAUSADO durante a janela do teste (nenhum push
 *    no repo enquanto o teste roda) - deploy no meio do teste invalida o
 *    resultado (foi o que aconteceu no teste de 11/09).
 *
 * Uso:
 *   k6 run infra/loadtest/checkout-launch.js \
 *     -e BASE_URL=https://eventflow-ctdc.onrender.com/api \
 *     -e EVENT_SLUG=slug-do-evento-de-teste \
 *     -e TICKET_TYPE_NAME="Lote Promocional" \
 *     -e LOT_QUANTITY=50 \
 *     -e PEAK_VUS=300
 *
 * Ajuste PEAK_VUS conforme a expectativa real de gente tentando comprar ao
 * mesmo tempo. Sem dado real de trafego, comece em 6x o tamanho do lote
 * (50 -> 300) para achar o ponto de quebra com margem de seguranca.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import { randomIntBetween, randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001/api";
const EVENT_SLUG = __ENV.EVENT_SLUG;
const TICKET_TYPE_NAME = __ENV.TICKET_TYPE_NAME || "Lote Promocional";
const LOT_QUANTITY = parseInt(__ENV.LOT_QUANTITY || "50", 10);
const PEAK_VUS = parseInt(__ENV.PEAK_VUS || "300", 10);

if (!EVENT_SLUG) {
  throw new Error("Defina -e EVENT_SLUG=<slug-do-evento-de-teste>. Nunca use o evento real aqui.");
}

export const checkoutSuccess = new Counter("checkout_success");
export const checkoutConflict = new Counter("checkout_conflict_409");
export const checkoutError = new Counter("checkout_error_outro");
export const checkoutLatency = new Trend("checkout_latency_ms", true);

export const options = {
  scenarios: {
    lote_rush: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: PEAK_VUS }, // todo mundo dando F5/comprando junto
        { duration: "20s", target: PEAK_VUS }, // sustenta o pico
        { duration: "10s", target: 0 } // acalma
      ],
      gracefulRampDown: "10s"
    }
  },
  thresholds: {
    checkout_latency_ms: ["p(95)<3000"],
    // taxa de erro "outro" (nao-conflito, nao-sucesso) deve ficar baixa;
    // 409 de estoque esgotado eh esperado e correto sob concorrencia.
    checkout_error_outro: ["count<20"]
  }
};

function randomDigits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += randomIntBetween(0, 9);
  return s;
}

function fakeBuyer(vuId, iter) {
  const id = `${vuId}-${iter}-${randomString(4)}`;
  return {
    buyerName: `Teste Carga ${id}`,
    buyerEmail: `loadtest+${id}@example.com`,
    buyerDocument: randomDigits(11),
    buyerPhone: `31${randomDigits(9)}`,
    paymentMethod: "PIX"
  };
}

let ticketTypeId = null;

export function setup() {
  const res = http.get(`${BASE_URL}/events/public/${EVENT_SLUG}`);
  if (res.status !== 200) {
    throw new Error(`Nao consegui carregar o evento de teste (status ${res.status}). Confirme EVENT_SLUG.`);
  }
  const body = res.json();
  const ticketTypes = body.ticketTypes || body.data?.ticketTypes || [];
  const match = ticketTypes.find((t) => t.name === TICKET_TYPE_NAME);
  if (!match) {
    throw new Error(
      `Lote "${TICKET_TYPE_NAME}" nao encontrado no evento ${EVENT_SLUG}. Lotes disponiveis: ${ticketTypes.map((t) => t.name).join(", ")}`
    );
  }
  return { ticketTypeId: match.id };
}

export default function (data) {
  const buyer = fakeBuyer(__VU, __ITER);
  const payload = JSON.stringify({
    ...buyer,
    items: [{ ticketTypeId: data.ticketTypeId, quantity: 1 }]
  });

  const res = http.post(`${BASE_URL}/checkout/${EVENT_SLUG}`, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { name: "checkout_create" }
  });

  checkoutLatency.add(res.timings.duration);

  if (res.status === 200 || res.status === 201) {
    checkoutSuccess.add(1);
  } else if (res.status === 409) {
    checkoutConflict.add(1);
  } else {
    checkoutError.add(1);
    console.error(`Erro inesperado (${res.status}): ${res.body?.slice(0, 300)}`);
  }

  check(res, {
    "nao é erro 5xx": (r) => r.status < 500
  });

  sleep(randomIntBetween(1, 3) / 10);
}

export function teardown() {
  console.log(`Fim do teste. Estoque do lote era ${LOT_QUANTITY}. Confira no banco: `);
  console.log(`  SELECT count(*) FROM "Order" o JOIN "OrderItem" oi ON oi."orderId" = o.id`);
  console.log(`  WHERE oi."ticketTypeId" = '<id-do-lote>' AND o.status IN ('PAID','PENDING');`);
  console.log(`Esse numero NUNCA pode passar de ${LOT_QUANTITY}. Se passar, é oversell e é bug critico.`);
}
