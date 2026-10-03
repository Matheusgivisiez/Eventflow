import { checkoutReturnOrigin } from "./checkout-return-origin";

describe("checkoutReturnOrigin", () => {
  const apex = "https://eventflowtickets.com.br";
  const www = "https://www.eventflowtickets.com.br";
  it.each([[apex, www], [www, apex], [www, www], [apex, apex]])(
    "returns from %s to the buyer's original %s host", (configured, requested) => {
      expect(checkoutReturnOrigin(configured, requested)).toBe(requested);
    }
  );
  it.each([undefined, "https://evil.example", `${apex}.evil.example`,
    "https://eventflowtickets.com.br@evil.example", `${apex}/redirect`,
    "http://eventflowtickets.com.br", "https://preview.vercel.app", "null"])(
    "does not send the order token to unapproved origin %s", (requested) => {
      expect(checkoutReturnOrigin(apex, requested)).toBe(apex);
    }
  );
  it("keeps development and other deployments isolated", () => {
    expect(checkoutReturnOrigin("http://localhost:3000", www)).toBe("http://localhost:3000");
  });
});
