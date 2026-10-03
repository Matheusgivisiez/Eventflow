import { UnauthorizedException } from "@nestjs/common";
import { createHmac } from "crypto";
import { WebhooksController } from "./webhooks.controller";

const rawBody = JSON.stringify({
  id: "webhook-1",
  event: "checkout.completed",
  data: { id: "checkout-1" }
});

function createController() {
  const webhooks = {
    handle: jest.fn().mockResolvedValue({ received: true })
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === "ABACATE_WEBHOOK_SECRET") return "webhook-secret";
      if (key === "ABACATE_PUBLIC_KEY") return "public-key";
      if (key === "INFINITEPAY_WEBHOOK_SECRET") return "infinitepay-webhook-secret-which-is-long-enough";
      return undefined;
    })
  };
  const controller = new WebhooksController(webhooks as any, config as any);
  const request = { rawBody: Buffer.from(rawBody) };
  const body = JSON.parse(rawBody);

  return { controller, webhooks, request, body };
}

function sign(payload: string) {
  return createHmac("sha256", "public-key").update(Buffer.from(payload, "utf8")).digest("base64");
}

describe("WebhooksController AbacatePay security", () => {
  it("rejects webhooks without the configured secret", async () => {
    const { controller, webhooks, request, body } = createController();

    expect(() => controller.abacatePay(body, request as any, undefined, sign(rawBody))).toThrow(UnauthorizedException);

    expect(webhooks.handle).not.toHaveBeenCalled();
  });

  it("rejects webhooks without a valid signature", async () => {
    const { controller, webhooks, request, body } = createController();

    expect(() => controller.abacatePay(body, request as any, "webhook-secret")).toThrow(UnauthorizedException);
    expect(() => controller.abacatePay(body, request as any, "webhook-secret", "invalid-signature")).toThrow(UnauthorizedException);

    expect(webhooks.handle).not.toHaveBeenCalled();
  });

  it("accepts webhooks with valid secret and signature", async () => {
    const { controller, webhooks, request, body } = createController();

    await expect(controller.abacatePay(body, request as any, "webhook-secret", sign(rawBody))).resolves.toEqual({ received: true });

    expect(webhooks.handle).toHaveBeenCalledWith("abacate_pay", body);
  });
});

describe("WebhooksController InfinitePay security", () => {
  it("accepts the configured secret from InfinitePay's webhook URL", async () => {
    const { controller, webhooks, body } = createController();

    await expect(controller.infinitePay(body, "infinitepay-webhook-secret-which-is-long-enough")).resolves.toEqual({ success: true });

    expect(webhooks.handle).toHaveBeenCalledWith("infinite_pay", body);
  });

  it("does not acknowledge success when processing fails", async () => {
    const { controller, webhooks, body } = createController();
    webhooks.handle.mockRejectedValue(new Error("provider unavailable"));
    await expect(controller.infinitePay(body, "infinitepay-webhook-secret-which-is-long-enough"))
      .rejects.toThrow("provider unavailable");
  });

  it("rejects a missing or invalid secret without processing the webhook", () => {
    const { controller, webhooks, body } = createController();

    expect(() => controller.infinitePay(body)).toThrow(UnauthorizedException);
    expect(() => controller.infinitePay(body, "wrong-secret")).toThrow(UnauthorizedException);
    expect(webhooks.handle).not.toHaveBeenCalled();
  });
});
