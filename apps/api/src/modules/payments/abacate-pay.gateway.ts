import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type AbacateCheckoutInput = {
  orderId: string;
  amountCents: number;
  buyerEmail: string;
  buyerName: string;
  buyerDocument?: string;
  buyerPhone?: string;
  description: string;
  returnUrl: string;
  completionUrl: string;
};

export type AbacateCheckoutResult = {
  provider: string;
  providerRef: string;
  checkoutUrl: string;
};

export type AbacatePixTransferInput = {
  pixKey: string;
  amountCents: number;
  description: string;
};

export type AbacatePixTransferResult = {
  providerRef: string;
  status: string;
};

const BASE_URL = "https://api.abacatepay.com/v2";

@Injectable()
export class AbacatePayGateway {
  private readonly logger = new Logger(AbacatePayGateway.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return this.config.get<string>("ABACATEPAY_API_KEY") ?? "";
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init?.headers ?? {})
      }
    });

    const body = await res.json() as { data: T; success: boolean; error: string | null };

    if (!res.ok || !body.success) {
      const msg = body.error ?? `AbacatePay error: HTTP ${res.status}`;
      this.logger.error(`AbacatePay API error [${path}]: ${msg}`);
      throw new InternalServerErrorException(`Falha no gateway de pagamento: ${msg}`);
    }

    return body.data;
  }

  /**
   * Creates an AbacatePay product (needed before creating a checkout).
   * Returns the AbacatePay product ID.
   */
  private async ensureProduct(input: AbacateCheckoutInput): Promise<string> {
    const product = await this.request<{ id: string }>("/products/create", {
      method: "POST",
      body: JSON.stringify({
        externalId: input.orderId,
        name: input.description,
        price: input.amountCents,
        currency: "BRL"
      })
    });
    return product.id;
  }

  /**
   * Creates a hosted checkout page on AbacatePay.
   */
  async createCheckout(input: AbacateCheckoutInput): Promise<AbacateCheckoutResult> {
    const productId = await this.ensureProduct(input);

    const checkout = await this.request<{ id: string; url: string }>("/checkouts/create", {
      method: "POST",
      body: JSON.stringify({
        items: [{ id: productId, quantity: 1 }],
        methods: ["PIX", "CARD"],
        customer: {
          email: input.buyerEmail,
          name: input.buyerName,
          taxId: input.buyerDocument,
          cellphone: input.buyerPhone
        },
        externalId: input.orderId,
        returnUrl: input.returnUrl,
        completionUrl: input.completionUrl,
        metadata: { orderId: input.orderId }
      })
    });

    return {
      provider: "abacate_pay",
      providerRef: checkout.id,
      checkoutUrl: checkout.url
    };
  }

  /**
   * Sends a PIX transfer to a third-party PIX key (used for organizer payouts).
   */
  async createPixTransfer(input: AbacatePixTransferInput): Promise<AbacatePixTransferResult> {
    const transfer = await this.request<{ id: string; status: string }>("/pix/create", {
      method: "POST",
      body: JSON.stringify({
        pixKey: input.pixKey,
        amount: input.amountCents,
        description: input.description
      })
    });

    return {
      providerRef: transfer.id,
      status: transfer.status
    };
  }
}
