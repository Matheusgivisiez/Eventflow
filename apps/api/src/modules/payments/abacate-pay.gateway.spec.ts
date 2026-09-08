import { AbacatePayGateway } from "./abacate-pay.gateway";

describe("AbacatePayGateway simulation", () => {
  const input = {
    orderId: "order-e2e",
    amountCents: 7900,
    buyerEmail: "buyer@example.com",
    buyerName: "Comprador Teste",
    description: "Evento Teste",
    returnUrl: "http://localhost:3000/checkout/success?orderId=order-e2e",
    completionUrl: "http://localhost:3000/checkout/success?orderId=order-e2e&status=paid"
  };

  it("prioriza o checkout simulado mesmo quando existe uma chave externa configurada", async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === "PAYMENT_SIMULATION_ENABLED") return true;
        if (key === "ABACATE_API_KEY") return "sandbox-provider-key";
        return undefined;
      })
    };
    const fetchSpy = jest.spyOn(global, "fetch");
    const gateway = new AbacatePayGateway(config as any);

    await expect(gateway.createCheckout(input)).resolves.toEqual({
      provider: "abacate_pay",
      providerRef: "sandbox:order-e2e",
      checkoutId: "sandbox:order-e2e",
      checkoutUrl: input.completionUrl
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("mantem o checkout local pendente ate a confirmacao simulada ou webhook", async () => {
    const config = { get: jest.fn(() => true) };
    const gateway = new AbacatePayGateway(config as any);

    await expect(gateway.getCheckout("sandbox:order-e2e")).resolves.toEqual({
      id: "sandbox:order-e2e",
      status: "PENDING"
    });
  });
});
