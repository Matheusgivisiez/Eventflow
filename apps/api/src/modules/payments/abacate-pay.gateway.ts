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
  paymentMethod?: string; // "PIX" | "CREDIT_CARD"
};

export type AbacateCheckoutResult = {
  provider: string;
  providerRef: string;
  checkoutId?: string;
  billId?: string;
  transactionId?: string;
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

@Injectable()
export class AbacatePayGateway {
  private readonly logger = new Logger(AbacatePayGateway.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return this.config.get<string>("ABACATE_API_KEY") ?? this.config.get<string>("ABACATEPAY_API_KEY") ?? "";
  }

  private get baseUrl(): string {
    return this.config.get<string>("ABACATE_BASE_URL") ?? this.config.get<string>("ABACATEPAY_BASE_URL") ?? "https://api.abacatepay.com/v2";
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(10000),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            ...(init?.headers ?? {})
          }
        });

        const body = await res.json().catch(() => null) as { data: T; success: boolean; error: string | null } | null;

        if (res.ok && body?.success) {
          return body.data;
        }

        const msg = body?.error ?? `AbacatePay error: HTTP ${res.status}`;
        if (attempt === 1 && (res.status === 429 || res.status >= 500)) {
          this.logger.warn(`Retrying AbacatePay API call [${path}] after ${res.status}: ${msg}`);
          continue;
        }

        this.logger.error(`AbacatePay API error [${path}]: ${msg}`);
        throw new InternalServerErrorException(`Falha no gateway de pagamento: ${msg}`);
      } catch (error) {
        lastError = error;
        if (attempt === 1) {
          this.logger.warn(`Retrying AbacatePay API call [${path}] after network error.`);
          continue;
        }
      }
    }

    this.logger.error(`AbacatePay API unavailable [${path}]`, lastError as Error);
    throw new InternalServerErrorException("Falha temporaria no gateway de pagamento.");
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

    // Map internal payment method to AbacatePay methods array
    const methods = input.paymentMethod === "CREDIT_CARD" ? ["CARD"] : ["PIX"];

    const checkout = await this.request<{ id: string; url: string; billId?: string; transactionId?: string }>("/checkouts/create", {
      method: "POST",
      body: JSON.stringify({
        items: [{ id: productId, quantity: 1 }],
        methods,
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
      checkoutId: checkout.id,
      billId: checkout.billId,
      transactionId: checkout.transactionId,
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
