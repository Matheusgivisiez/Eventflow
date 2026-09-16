import { InfinitePayGateway } from "./infinite-pay.gateway";

describe("InfinitePayGateway", () => {
  const input = {
    orderId: "order-1",
    amountCents: 10800,
    buyerEmail: "buyer@example.com",
    buyerName: "Buyer",
    description: "Event Flow Conf",
    returnUrl: "https://app.example/checkout/success?orderId=order-1",
    completionUrl: "https://app.example/checkout/success?orderId=order-1"
  };

  const config = {
    get: jest.fn((key: string) => ({
      INFINITEPAY_HANDLE: "eventflow",
      API_URL: "https://api.example",
      INFINITEPAY_WEBHOOK_SECRET: "webhook-secret"
    } as Record<string, string>)[key])
  };

  beforeEach(() => jest.clearAllMocks());

  it("creates a hosted checkout with the local order as order_nsu", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      url: "https://pay.infinitepay.io/abc",
      slug: "abc"
    }), { status: 200 }));
    const gateway = new InfinitePayGateway(config as any);

    await expect(gateway.createCheckout(input)).resolves.toEqual(expect.objectContaining({
      provider: "infinite_pay",
      providerRef: "abc",
      checkoutId: "abc",
      checkoutUrl: "https://pay.infinitepay.io/abc"
    }));
    expect(fetch).toHaveBeenCalledWith("https://api.checkout.infinitepay.io/links", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"order_nsu":"order-1"')
    }));
  });

  it("verifies the payment using all InfinitePay identifiers", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: true,
      paid: true,
      amount: 10800,
      paid_amount: 10800,
      installments: 1,
      capture_method: "pix"
    }), { status: 200 }));
    const gateway = new InfinitePayGateway(config as any);

    await expect(gateway.verifyPayment({
      orderId: "order-1",
      checkoutId: "abc",
      transactionId: "tx-1"
    })).resolves.toEqual(expect.objectContaining({
      id: "tx-1",
      status: "PAID",
      amountCents: 10800,
      paymentMethod: "pix"
    }));
    expect(fetch).toHaveBeenCalledWith("https://api.checkout.infinitepay.io/payment_check", expect.objectContaining({
      body: expect.stringContaining('"transaction_nsu":"tx-1"')
    }));
  });
});
