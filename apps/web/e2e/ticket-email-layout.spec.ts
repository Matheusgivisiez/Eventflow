import { test, expect } from "@playwright/test";
import { renderPurchaseConfirmed } from "../../api/src/modules/notifications/templates/purchase-confirmed.template";

// The HTML is rendered directly: no API, account or outbound mail is needed.
for (const vip of [false, true]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`ticket email stays compact on mobile: ${vip ? "VIP" : "standard"}, ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.emulateMedia({ colorScheme });
      await page.route("https://email.test/**", (route) => route.abort());
      const mail = renderPurchaseConfirmed({
        buyerName: "Riquelmy Soares Vasconcelos", eventTitle: "HALLOWPARTY",
        eventStartsAt: new Date("2026-11-07T01:00:00Z"),
        eventVenue: "Avenida Carlos Chagas, 602, Cidade Nobre, Ipatinga, MG",
        orderId: "order-12345678", ticketCount: 1,
        orderUrl: "https://email.test/order", createAccountUrl: "https://email.test/register",
        qrCodeLocked: false, qrCodeReleaseAt: null,
        logoLightUrl: "https://email.test/logo-light.png", logoDarkUrl: "https://email.test/logo-dark.png",
        qrLockedImageUrl: "https://email.test/locked.png", assetsBaseUrl: "https://email.test/assets",
        vipInvite: vip ? { invitedBy: "Event Flow" } : undefined,
        tickets: [{ id: "t1", attendeeName: "Riquelmy Soares Vasconcelos",
          ticketTypeName: vip ? "Convidado VIP" : "Pista — 1º Lote", shortCode: "9F6F260E25",
          pdfUrl: "https://email.test/ticket.pdf", qrImageSrc: "https://email.test/qr.png" }],
      });
      await page.setContent(mail.html);
      const layout = await page.evaluate(() => {
        const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
        const left = rect(".ef-ticket-left"), right = rect(".ef-ticket-right");
        const info = [...document.querySelectorAll(".ef-info-cell")].map((cell) => {
          const icon = cell.querySelector("img")!.getBoundingClientRect();
          const text = cell.querySelector(".ef-info-value")!.getBoundingClientRect();
          return text.left - icon.right;
        });
        return {
          width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
          leftTop: left.top, rightTop: right.top, gap: right.left - left.right,
          qrWidth: rect('img[alt="QR Code do ingresso"]').width,
          infoGaps: info,
          metaTops: [...document.querySelectorAll(".ef-meta-cell")].slice(0, 2).map((node) => node.getBoundingClientRect().top),
          buttonTops: [...document.querySelectorAll(".ef-button")].map((node) => node.getBoundingClientRect().top),
        };
      });
      expect(layout.width).toBe(375);
      expect(layout.height).toBeLessThan(1250);
      expect(layout.leftTop).toBe(layout.rightTop);
      expect(layout.gap).toBeGreaterThanOrEqual(0);
      expect(layout.qrWidth).toBeGreaterThan(110);
      for (const gap of layout.infoGaps) expect(gap).toBeGreaterThanOrEqual(5);
      expect(new Set(layout.buttonTops).size).toBe(1);
      expect(new Set(layout.metaTops).size).toBe(1);
    });
  }
}
