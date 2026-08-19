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

    expect(() => controller.abacatePay(body, request as any, undefined, undefined, sign(rawBody))).toThrow(UnauthorizedException);

    expect(webhooks.handle).not.toHaveBeenCalled();
  });

  it("rejects webhooks without a valid signature", async () => {
    const { controller, webhooks, request, body } = createController();

    expect(() => controller.abacatePay(body, request as any, "webhook-secret")).toThrow(UnauthorizedException);
    expect(() => controller.abacatePay(body, request as any, "webhook-secret", undefined, "invalid-signature")).toThrow(UnauthorizedException);

    expect(webhooks.handle).not.toHaveBeenCalled();
  });

  it("accepts webhooks with valid secret and signature", async () => {
    const { controller, webhooks, request, body } = createController();

    await expect(controller.abacatePay(body, request as any, "webhook-secret", undefined, sign(rawBody))).resolves.toEqual({ received: true });

    expect(webhooks.handle).toHaveBeenCalledWith("abacate_pay", body);
  });
});
