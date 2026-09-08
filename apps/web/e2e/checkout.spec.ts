import { expect, test } from "@playwright/test";
import type { APIResponse } from "@playwright/test";
import { createHmac } from "node:crypto";

const eventSlug = "summit-eventflow-2026";
const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3001/api";
const webhookSigningKey = "eventflow-local-public-key";

async function expectOk(response: APIResponse) {
  if (!response.ok()) {
    throw new Error(`HTTP ${response.status()}: ${await response.text()}`);
  }
}

test.describe("Fluxo de compra", () => {
  test("exibe o evento publicado e o seletor de ingressos", async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });

    await page.goto(`/eventos/${eventSlug}`);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Summit Event Flow 2026");
    await expect(page.locator('[data-testid="ticket-selector"]')).toBeVisible();
    await expect.poll(() => runtimeErrors).toEqual([]);
  });

  test("processa compra, webhook, emissao e check-in com duplicidade", async ({ page, request }) => {
    const eventResponse = await request.get(`${apiUrl}/events/public/${eventSlug}`);
    await expectOk(eventResponse);
    const event = await eventResponse.json() as {
      id: string;
      ticketTypes: Array<{ id: string; isActive: boolean }>;
    };
    const ticketType = event.ticketTypes.find((item) => item.isActive);
    expect(ticketType).toBeTruthy();

    const runId = `${Date.now()}-${test.info().workerIndex}`;
    const checkoutResponse = await request.post(`${apiUrl}/checkout/${eventSlug}`, {
      data: {
        buyerName: "Comprador E2E",
        buyerEmail: `comprador-e2e-${runId}@example.com`,
        buyerDocument: "52998224725",
        buyerPhone: "11999999999",
        paymentMethod: "PIX",
        items: [{ ticketTypeId: ticketType!.id, quantity: 1 }]
      }
    });
    await expectOk(checkoutResponse);
    const checkout = await checkoutResponse.json() as {
      orderId: string;
      orderAccessToken: string;
    };

    const webhookPayload = {
      id: `e2e-webhook-${runId}`,
      event: "checkout.completed",
      data: {
        checkout: {
          id: `sandbox:${checkout.orderId}`,
          externalId: checkout.orderId
        }
      }
    };
    const rawWebhook = JSON.stringify(webhookPayload);
    const webhookSignature = createHmac("sha256", webhookSigningKey)
      .update(rawWebhook)
      .digest("base64");
    const webhookResponse = await request.post(`${apiUrl}/webhooks/abacatepay`, {
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": "eventflow-local-webhook-secret",
        "x-webhook-signature": webhookSignature
      },
      data: rawWebhook
    });
    await expectOk(webhookResponse);

    const orderResponse = await request.get(
      `${apiUrl}/checkout/order/${checkout.orderId}?accessToken=${encodeURIComponent(checkout.orderAccessToken)}`
    );
    await expectOk(orderResponse);
    const order = await orderResponse.json() as {
      status: string;
      tickets: Array<{ uuid: string; status: string }>;
    };
    expect(order.status).toBe("PAID");
    expect(order.tickets).toHaveLength(1);
    expect(order.tickets[0].status).toBe("AVAILABLE");

    await page.goto(
      `/checkout/success?orderId=${checkout.orderId}&accessToken=${encodeURIComponent(checkout.orderAccessToken)}`
    );
    await expect(page.getByText("Pagamento Confirmado!", { exact: true })).toBeVisible();

    const loginResponse = await request.post(`${apiUrl}/auth/login`, {
      data: {
        email: "organizador@eventflow.local",
        password: "EventFlow@123"
      }
    });
    await expectOk(loginResponse);
    const session = await loginResponse.json() as { accessToken: string };

    const validateTicket = () => request.post(`${apiUrl}/check-in/events/${event.id}/validate`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { code: order.tickets[0].uuid }
    });

    const firstCheckIn = await validateTicket();
    await expectOk(firstCheckIn);
    expect((await firstCheckIn.json()).status).toBe("ENTERED");

    const duplicateCheckIn = await validateTicket();
    await expectOk(duplicateCheckIn);
    expect((await duplicateCheckIn.json()).status).toBe("DUPLICATED");
  });
});
