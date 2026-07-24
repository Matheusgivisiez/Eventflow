import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { createHmac, timingSafeEqual } from "crypto";
import { WebhooksService } from "./webhooks.service";

function validateStripeSignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.trim().split("=");
      if (k && v) acc[k] = v;
      return acc;
    }, {});
    const sig = parts["v1"];
    if (!sig) return false;
    const computed = createHmac("sha256", secret).update(payload).digest("hex");
    return timingSafeEqual(Buffer.from(computed), Buffer.from(sig));
  } catch {
    return false;
  }
}

function validateMercadoPagoSignature(payload: Record<string, unknown>, xSignature: string | undefined, secret: string): boolean {
  if (!xSignature || !secret) return false;
  try {
    const parts = xSignature.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.trim().split("=");
      if (k && v) acc[k] = v;
      return acc;
    }, {});
    const ts = parts["ts"];
    const hash = parts["v1"];
    if (!ts || !hash) return false;
    const dataId = String(payload["data_id"] ?? "");
    const computed = createHmac("sha256", secret).update(`${dataId}${ts}`).digest("hex");
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  } catch {
    return false;
  }
}

function validateAsaasSignature(payload: Record<string, unknown>, xSignature: string | undefined, secret: string): boolean {
  if (!xSignature || !secret) return false;
  try {
    const computed = createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
    return timingSafeEqual(Buffer.from(computed), Buffer.from(xSignature));
  } catch {
    return false;
  }
}

@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhooksController {
  private readonly stripeSecret: string;
  private readonly mpSecret: string;
  private readonly asaasSecret: string;
  private readonly abacatePaySecret: string;

  constructor(
    private readonly webhooks: WebhooksService,
    config: ConfigService
  ) {
    this.stripeSecret = config.get<string>("STRIPE_WEBHOOK_SECRET") ?? "";
    this.mpSecret = config.get<string>("MERCADO_PAGO_WEBHOOK_SECRET") ?? "";
    this.asaasSecret = config.get<string>("ASAAS_WEBHOOK_SECRET") ?? "";
    this.abacatePaySecret = config.get<string>("ABACATEPAY_WEBHOOK_SECRET") ?? "";
  }

  @Post("mercado-pago")
  mercadoPago(
    @Body() body: Record<string, unknown>,
    @Headers("x-signature") xSignature?: string
  ) {
    if (this.mpSecret && !validateMercadoPagoSignature(body, xSignature, this.mpSecret)) {
      throw new UnauthorizedException("Assinatura do webhook invalida.");
    }
    return this.webhooks.handle("mercado_pago", body);
  }

  @Post("stripe")
  stripe(
    @Body() body: Record<string, unknown>,
    @Headers("stripe-signature") stripeSignature?: string,
    @Headers() headers?: Record<string, string>
  ) {
    if (this.stripeSecret) {
      const rawBody = headers?.["x-raw-body"] ?? JSON.stringify(body);
      if (!validateStripeSignature(rawBody, stripeSignature, this.stripeSecret)) {
        throw new UnauthorizedException("Assinatura do webhook invalida.");
      }
    }
    return this.webhooks.handle("stripe", body);
  }

  @Post("asaas")
  asaas(
    @Body() body: Record<string, unknown>,
    @Headers("x-signature") xSignature?: string
  ) {
    if (this.asaasSecret && !validateAsaasSignature(body, xSignature, this.asaasSecret)) {
      throw new UnauthorizedException("Assinatura do webhook invalida.");
    }
    return this.webhooks.handle("asaas", body);
  }

  @Post("abacate-pay")
  abacatePay(
    @Body() body: Record<string, unknown>,
    @Headers("x-webhook-secret") xSecret?: string
  ) {
    if (this.abacatePaySecret && xSecret !== this.abacatePaySecret) {
      throw new UnauthorizedException("Assinatura do webhook invalida.");
    }
    return this.webhooks.handle("abacate_pay", body);
  }
}
