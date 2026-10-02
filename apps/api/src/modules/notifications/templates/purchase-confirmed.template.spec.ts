import { renderPurchaseConfirmed } from "./purchase-confirmed.template";

function input(overrides: Record<string, unknown> = {}) {
  return {
    buyerName: "Buyer Test",
    eventTitle: "Event Flow Conf",
    eventStartsAt: new Date("2026-12-12T18:00:00.000Z"),
    eventVenue: "Online",
    orderId: "order-1",
    ticketCount: 1,
    orderUrl: "https://app.example/checkout/success?orderId=order-1",
    createAccountUrl: "https://app.example/register",
    qrCodeLocked: true,
    qrCodeReleaseAt: null,
    logoLightUrl: "https://app.example/l.png",
    logoDarkUrl: "https://app.example/d.png",
    qrLockedImageUrl: "https://app.example/q.png",
    assetsBaseUrl: "https://app.example/images/email",
    tickets: [{ id: "t1", attendeeName: "Buyer Test", ticketTypeName: "Inteira", shortCode: "A1B2C3D4E5", pdfUrl: "https://app.example/pdf" }],
    ...overrides
  } as any;
}

describe("renderPurchaseConfirmed copy", () => {
  it("keeps the payment wording for a paid purchase", () => {
    const mail = renderPurchaseConfirmed(input());

    expect(mail.html).toContain("Pagamento confirmado");
    expect(mail.text).toContain("Seu pagamento foi aprovado");
    expect(mail.html).not.toContain("Inscrição confirmada");
  });

  it("never mentions payment for a zero-total order", () => {
    const mail = renderPurchaseConfirmed(input({ free: true }));

    expect(mail.html).toContain("Inscrição confirmada");
    expect(mail.text).toContain("Sua inscrição foi confirmada");
    expect(`${mail.html}${mail.text}`.toLowerCase()).not.toContain("pagamento");
    expect(mail.html).not.toContain("Sua compra foi aprovada");
  });
});
