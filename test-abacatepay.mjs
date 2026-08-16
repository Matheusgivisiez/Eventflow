/**
 * Script de diagnóstico: testa cada etapa do fluxo de checkout AbacatePay
 * Rode com: node test-abacatepay.mjs
 */

const API_KEY = "abc_dev_NjHH6pQn2fyj0zQH1gh11jWM";
const BASE_URL = "https://api.abacatepay.com/v2";

async function req(path, body) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n📡 POST ${path}`);
  console.log("Payload:", JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  console.log(`Status: ${res.status}`);
  console.log("Response:", JSON.stringify(json, null, 2));

  if (!res.ok || !json?.success) {
    throw new Error(`Falha em ${path}: ${json?.error ?? res.status}`);
  }

  return json.data;
}

async function main() {
  const testOrderId = `test_order_${Date.now()}`;

  console.log("=".repeat(60));
  console.log("🧪 DIAGNÓSTICO ABACATEPAY - FLUXO CHECKOUT");
  console.log("=".repeat(60));

  // 1. Criar Customer
  console.log("\n[1/3] Criando Customer...");
  let customerId;
  try {
    const customer = await req("/customers/create", {
      email: "teste@eventhub.local",
      name: "Usuario Teste",
      taxId: "12201513600",
      cellphone: "31985955542",
    });
    customerId = customer.id;
    console.log("✅ Customer criado:", customerId);
  } catch (e) {
    console.error("❌ Erro ao criar customer:", e.message);
    process.exit(1);
  }

  // 2. Criar Produto
  console.log("\n[2/3] Criando Produto...");
  let productId;
  try {
    const product = await req("/products/create", {
      externalId: testOrderId,
      name: "Ingresso Teste - EventHub",
      price: 19440,
      currency: "BRL",
    });
    productId = product.id;
    console.log("✅ Produto criado:", productId);
  } catch (e) {
    console.error("❌ Erro ao criar produto:", e.message);
    process.exit(1);
  }

  // 3. Criar Checkout
  console.log("\n[3/3] Criando Checkout...");
  try {
    const checkout = await req("/checkouts/create", {
      items: [{ id: productId, quantity: 1 }],
      methods: ["PIX"],
      customerId,
      externalId: testOrderId,
      returnUrl: "http://localhost:3000/checkout/success?orderId=" + testOrderId,
      completionUrl: "http://localhost:3000/checkout/success?orderId=" + testOrderId + "&status=paid",
      metadata: { orderId: testOrderId },
    });
    console.log("✅ Checkout criado!");
    console.log("checkoutUrl:", checkout.url);
  } catch (e) {
    console.error("❌ Erro ao criar checkout:", e.message);
    process.exit(1);
  }

  console.log("\n=".repeat(60));
  console.log("✅ FLUXO COMPLETO COM SUCESSO");
  console.log("=".repeat(60));
}

main().catch(console.error);
