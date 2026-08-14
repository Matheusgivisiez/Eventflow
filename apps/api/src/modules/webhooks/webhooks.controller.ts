import { Body, Controller, Headers, Post, Query, RawBodyRequest, Req, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { createHmac, timingSafeEqual } from "crypto";
import { Request } from "express";
import { SkipThrottle } from "@nestjs/throttler";
import { WebhooksService } from "./webhooks.service";

const ABACATEPAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

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

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function validateAbacatePaySignature(rawBody: string, signature: string | undefined, publicKey: string): boolean {
  if (!signature || !publicKey) return false;
  const computed = createHmac("sha256", publicKey).update(Buffer.from(rawBody, "utf8")).digest("base64");
  return safeCompare(computed, signature);
}

@SkipThrottle()
@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhooksController {
  private readonly stripeSecret: string;
  private readonly mpSecret: string;
  private readonly asaasSecret: string;
  private readonly abacatePaySecret: string;
  private readonly abacatePayPublicKey: string;

  constructor(
    private readonly webhooks: WebhooksService,
    config: ConfigService
  ) {
    this.stripeSecret = config.get<string>("STRIPE_WEBHOOK_SECRET") ?? "";
    this.mpSecret = config.get<string>("MERCADO_PAGO_WEBHOOK_SECRET") ?? "";
    this.asaasSecret = config.get<string>("ASAAS_WEBHOOK_SECRET") ?? "";
    this.abacatePaySecret = config.get<string>("ABACATE_WEBHOOK_SECRET") ?? config.get<string>("ABACATEPAY_WEBHOOK_SECRET") ?? "";
    this.abacatePayPublicKey = config.get<string>("ABACATE_PUBLIC_KEY") ?? config.get<string>("ABACATEPAY_PUBLIC_KEY") ?? ABACATEPAY_PUBLIC_KEY;
  }

  @Post("mercado-pago")
  mercadoPago(
    @Body() body: Record<string, unknown>,
    @Headers("x-signature") xSignature?: string
  ) {
    if (!this.mpSecret || !validateMercadoPagoSignature(body, xSignature, this.mpSecret)) {
      throw new UnauthorizedException("Assinatura do webhook invalida ou secret nao configurado.");
    }
    return this.webhooks.handle("mercado_pago", body);
  }

  @Post("stripe")
  stripe(
    @Body() body: Record<string, unknown>,
    @Headers("stripe-signature") stripeSignature?: string,
    @Headers() headers?: Record<string, string>
  ) {
    const rawBody = headers?.["x-raw-body"] ?? JSON.stringify(body);
    if (!this.stripeSecret || !validateStripeSignature(rawBody, stripeSignature, this.stripeSecret)) {
      throw new UnauthorizedException("Assinatura do webhook invalida ou secret nao configurado.");
    }
    return this.webhooks.handle("stripe", body);
  }

  @Post("asaas")
  asaas(
    @Body() body: Record<string, unknown>,
    @Headers("x-signature") xSignature?: string
  ) {
    if (!this.asaasSecret || !validateAsaasSignature(body, xSignature, this.asaasSecret)) {
      throw new UnauthorizedException("Assinatura do webhook invalida ou secret nao configurado.");
    }
    return this.webhooks.handle("asaas", body);
  }

  @Post("abacatepay")
  abacatePay(
    @Body() body: Record<string, unknown>,
    @Req() req: RawBodyRequest<Request>,
    @Query("webhookSecret") webhookSecret?: string,
    @Headers("x-webhook-secret") xSecret?: string,
    @Headers("x-webhook-signature") xSignature?: string
  ) {
    const providedSecret = webhookSecret ?? xSecret;
    const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(body);

    if (!this.abacatePaySecret || providedSecret !== this.abacatePaySecret) {
      throw new UnauthorizedException("Secret do webhook inalterado ou invalido.");
    }

    if (xSignature && this.abacatePayPublicKey) {
      const isValidSig = validateAbacatePaySignature(rawBody, xSignature, this.abacatePayPublicKey);
      if (!isValidSig) {
        throw new UnauthorizedException("Assinatura HMAC do webhook invalida.");
      }
    }

    return this.webhooks.handle("abacate_pay", body);
  }

  @Post("abacate-pay")
  abacatePayLegacy(
    @Body() body: Record<string, unknown>,
    @Req() req: RawBodyRequest<Request>,
    @Query("webhookSecret") webhookSecret?: string,
    @Headers("x-webhook-secret") xSecret?: string,
    @Headers("x-webhook-signature") xSignature?: string
  ) {
    return this.abacatePay(body, req, webhookSecret, xSecret, xSignature);
  }
}
