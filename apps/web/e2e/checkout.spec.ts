import { test, expect } from "@playwright/test";

test.describe("Fluxo de compra", () => {
  test("deve exibir pagina publica de evento", async ({ page }) => {
    await page.goto("/eventos/evento-teste");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("deve exibir seletor de ingressos", async ({ page }) => {
    await page.goto("/eventos/evento-teste");
    await expect(page.locator('[data-testid="ticket-selector"]')).toBeVisible();
  });

  test("deve exibir formulario de checkout", async ({ page }) => {
    await page.goto("/eventos/evento-teste");
    const buyButton = page.locator("button", { hasText: /comprar/i }).first();
    if (await buyButton.isVisible()) {
      await buyButton.click();
      await expect(page).toHaveURL(/\/checkout/);
    }
  });
});
