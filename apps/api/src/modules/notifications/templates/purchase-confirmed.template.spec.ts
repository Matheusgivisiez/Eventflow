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

    expect(mail.html).toContain("Sua compra foi aprovada");
    expect(mail.text).toContain("Seu pagamento foi aprovado");
    expect(mail.html).not.toContain("&#10003;");
    expect(mail.html).not.toContain("#8ff2d6");
    expect(mail.html).not.toContain("Inscrição confirmada");
  });

  it("never mentions payment for a zero-total order", () => {
    const mail = renderPurchaseConfirmed(input({ free: true }));

    expect(mail.html).toContain("Inscrição confirmada");
    expect(mail.text).toContain("Sua inscrição foi confirmada");
    expect(`${mail.html}${mail.text}`.toLowerCase()).not.toContain("pagamento");
    expect(mail.html).not.toContain("Sua compra foi aprovada");
  });

  it("speaks of an invitation, never of payment, purchase or sign-up, for a courtesy ticket", () => {
    const mail = renderPurchaseConfirmed(input({ free: true, courtesy: true, tickets: [{ id: "t1", attendeeName: "Convidada", ticketTypeName: "Convidado VIP", shortCode: "A1B2C3D4E5", pdfUrl: "https://app.example/pdf" }] }));

    expect(mail.html).toContain("Seu convite foi confirmado");
    expect(mail.text).toContain("Seu convite foi confirmado");
    expect(mail.html).toContain("Convidado VIP");
    const all = `${mail.html}${mail.text}`.toLowerCase();
    expect(all).not.toContain("pagamento");
    expect(all).not.toContain("sua compra");
    expect(all).not.toContain("inscrição");
  });

  it("renders a gold nominal invitation only when explicitly marked VIP", () => {
    const mail = renderPurchaseConfirmed(input({
      vipInvite: { invitedBy: "Organização do Festival" },
      qrCodeLocked: false,
      tickets: [{ id: "t1", attendeeName: "Buyer Test", ticketTypeName: "VIP", shortCode: "A1B2C3D4E5", pdfUrl: "https://app.example/vip.pdf", qrImageSrc: "cid:qr-vip" }],
    }));

    expect(mail.subject).toContain("convite Premium");
    expect(mail.html).toContain("Bem-vindo à");
    expect(mail.html).toContain("experiência Premium.");
    expect(mail.html).toContain("vip-bg.png");
    expect(mail.html).toContain("vip-logo-white.png");
    expect(mail.html).toContain("Convite VIP nominal e intransferível.");
    expect(mail.text).toContain("Organização do Festival");
    expect(mail.text).not.toMatch(/pagamento|compra|transferiu|Pedido:/i);
  });

  it("keeps a normally purchased ticket named VIP in the standard design", () => {
    const mail = renderPurchaseConfirmed(input({
      tickets: [{ id: "t1", attendeeName: "Buyer Test", ticketTypeName: "VIP", shortCode: "A1B2C3D4E5", pdfUrl: "https://app.example/pdf" }],
    }));
    expect(mail.html).toContain("ticket-card-bg.png");
    expect(mail.html).not.toContain("vip-bg.png");
    expect(mail.html).toContain("Sua compra foi aprovada");
  });
});
