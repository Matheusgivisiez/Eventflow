/**
 * Teste de carga do "rush" de abertura de lote.
 *
 * Cenario: N compradores tentando comprar, cada um UMA VEZ (no maximo uma
 * retentativa em caso de 409/estoque), tudo na mesma onda - e assim que
 * uma pessoa real se comporta quando o lote abre, não fica retentando em
 * loop. Mede se o checkout aguenta o pico e se o numero de pedidos PAGOS
 * nunca ultrapassa o estoque do lote (oversell).
 *
 * IMPORTANTE sobre rate limit: a rota de checkout tem @Throttle de 300
 * requisicoes/minuto POR IP (apps/api/src/modules/checkout/checkout.controller.ts).
 * Rodando o k6 de uma unica maquina, todos os VUs saem do MESMO IP - se o
 * numero de compradores (PEAK_VUS) passar de ~280-300 dentro de 60s, voce
 * vai medir o rate limiter, nao o checkout. Isso é esperado e é uma
 * protecao real (nao desligar so pra o teste passar) - mas significa que
 * esse script, rodado de uma maquina so, não simula mais que ~280
 * compradores por minuto de forma limpa. Se quiser testar acima disso,
 * precisa distribuir a origem (varias maquinas/IPs, ou um servico de
 * load-test distribuido tipo k6 Cloud/Grafana Cloud).
 *
 * NUNCA rode isso contra o evento real (Hallowparty). Rode contra um evento
 * descartavel criado so para o teste.
 *
 * Uso:
 *   k6 run infra/loadtest/checkout-launch.js \
 *     -e BASE_URL=https://eventflow-ctdc.onrender.com/api \
 *     -e EVENT_SLUG=slug-do-evento-de-teste \
 *     -e TICKET_TYPE_NAME="Lote Promocional" \
 *     -e LOT_QUANTITY=50 \
 *     -e BUYERS=150
 *
 * BUYERS = quantas pessoas tentam comprar nessa onda (nao um "VUs por
 * segundo", e o numero total de compradores simulados, cada um com no
 * maximo 2 tentativas). Mantenha BUYERS abaixo de ~280 para nao confundir
 * rate limit com capacidade real. Comece em 3x o tamanho do lote.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import { randomIntBetween, randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001/api";
const EVENT_SLUG = __ENV.EVENT_SLUG;
const TICKET_TYPE_NAME = __ENV.TICKET_TYPE_NAME || "Lote Promocional";
const LOT_QUANTITY = parseInt(__ENV.LOT_QUANTITY || "50", 10);
const BUYERS = parseInt(__ENV.BUYERS || "150", 10);

if (!EVENT_SLUG) {
  throw new Error("Defina -e EVENT_SLUG=<slug-do-evento-de-teste>. Nunca use o evento real aqui.");
}

if (BUYERS > 280) {
  console.warn(
    `AVISO: BUYERS=${BUYERS} está perto ou acima do limite de 300/min por IP. ` +
    `Rodando de uma unica maquina, isso vai medir o rate limiter, nao o checkout.`
  );
}

export const checkoutSuccess = new Counter("checkout_success");
export const checkoutConflict = new Counter("checkout_conflict_409");
export const checkoutRateLimited = new Counter("checkout_rate_limited_429");
export const checkoutError = new Counter("checkout_error_outro");
export const checkoutLatency = new Trend("checkout_latency_ms", true);

export const options = {
  scenarios: {
    lote_rush: {
      executor: "per-vu-iterations",
      vus: BUYERS,
      iterations: 1, // cada comprador tenta uma vez (retry, se precisar, é dentro do proprio VU)
      maxDuration: "60s"
    }
  },
  thresholds: {
    checkout_latency_ms: ["p(95)<5000"],
    checkout_rate_limited_429: ["count<5"] // se isso disparar, o teste mediu rate limit, nao capacidade
  }
};

function randomDigits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += randomIntBetween(0, 9);
  return s;
}

// CPF exige digitos verificadores reais (mod 11) - o backend valida isso
// no use-case, nao so o formato. Gera um CPF valido de verdade, senao todo
// mundo cai em 400 antes de chegar perto do lock de estoque (foi o que
// aconteceu na segunda rodada: 148/150 em "CPF invalido").
function randomValidCpf() {
  const calcDigit = (digits, weights) => {
    const total = digits.reduce((sum, d, i) => sum + d * weights[i], 0);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const base = Array.from({ length: 9 }, () => randomIntBetween(0, 9));
    if (base.every((d) => d === base[0])) continue; // evita 000000000 etc
    const d1 = calcDigit(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calcDigit([...base, d1], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const cpf = [...base, d1, d2].join("");
    if (!/^(\d)\1+$/.test(cpf)) return cpf;
  }
  throw new Error("Nao consegui gerar CPF valido (bug no gerador, nao no teste).");
}

function fakeBuyer(vuId, iter) {
  const id = `${vuId}-${iter}-${randomString(4)}`;
  return {
    buyerName: `Teste Carga ${id}`,
    buyerEmail: `loadtest+${id}@example.com`,
    buyerDocument: randomValidCpf(),
    buyerPhone: `31${randomDigits(9)}`,
    paymentMethod: "PIX"
  };
}

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

function attemptCheckout(data, buyer) {
  const payload = JSON.stringify({
    ...buyer,
    items: [{ ticketTypeId: data.ticketTypeId, quantity: 1 }]
  });
  return http.post(`${BASE_URL}/checkout/${EVENT_SLUG}`, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { name: "checkout_create" }
  });
}

export default function (data) {
  // Todos os VUs largam quase juntos (per-vu-iterations não escalona o
  // início, mas um pequeno jitter evita que todo mundo bata no msmo ms
  // exato, o que é mais realista - pessoas clicam "comprar" em instantes
  // ligeiramente diferentes, não no mesmo microsegundo).
  sleep(randomIntBetween(0, 500) / 1000);

  const buyer = fakeBuyer(__VU, __ITER);
  let res = attemptCheckout(data, buyer);
  checkoutLatency.add(res.timings.duration);

  // Uma pessoa real, se vir "tente novamente", tenta de novo uma vez.
  if (res.status === 409) {
    sleep(randomIntBetween(500, 1500) / 1000);
    res = attemptCheckout(data, buyer);
    checkoutLatency.add(res.timings.duration);
  }

  if (res.status === 200 || res.status === 201) {
    checkoutSuccess.add(1);
  } else if (res.status === 409) {
    checkoutConflict.add(1);
  } else if (res.status === 429) {
    checkoutRateLimited.add(1);
  } else {
    checkoutError.add(1);
    console.error(`Erro inesperado (${res.status}): ${res.body?.slice(0, 300)}`);
  }

  check(res, {
    "nao é erro 5xx": (r) => r.status < 500
  });
}

export function teardown() {
  console.log(`Fim do teste. Estoque do lote era ${LOT_QUANTITY}. Confira no banco: `);
  console.log(`  SELECT count(*) FROM "Order" o JOIN "OrderItem" oi ON oi."orderId" = o.id`);
  console.log(`  WHERE oi."ticketTypeId" = '<id-do-lote>' AND o.status IN ('PAID','PENDING');`);
  console.log(`Esse numero NUNCA pode passar de ${LOT_QUANTITY}. Se passar, é oversell e é bug critico.`);
}
