import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CreatePaymentCheckoutInput, CreatedPaymentCheckout, PaymentProvider, PaymentVerification, VerifyPaymentInput } from "./payment-provider";

type InfinitePayLink = {
  url?: string;
  checkout_url?: string;
  slug?: string;
  invoice_slug?: string;
  transaction_nsu?: string;
};

type InfinitePayStatus = {
  success?: boolean;
  paid?: boolean;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
};

@Injectable()
export class InfinitePayGateway implements PaymentProvider {
  readonly id = "infinite_pay" as const;
  private readonly logger = new Logger(InfinitePayGateway.name);

  constructor(private readonly config: ConfigService) {}

  private get handle() {
    return (this.config.get<string>("INFINITEPAY_HANDLE") ?? "").trim().replace(/^\$+/, "");
  }

  private get baseUrl() {
    return (this.config.get<string>("INFINITEPAY_BASE_URL") ?? "https://api.checkout.infinitepay.io").replace(/\/+$/, "");
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!this.handle) throw new InternalServerErrorException("INFINITEPAY_HANDLE nao configurado.");
    try {
      const apiKey = this.config.get<string>("INFINITEPAY_API_KEY");
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => null) as T | { message?: string } | null;
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : `HTTP ${response.status}`;
        throw new InternalServerErrorException(`Falha na InfinitePay: ${message}`);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.logger.warn(`InfinitePay indisponivel em ${path}.`);
      throw new InternalServerErrorException("Falha temporaria na InfinitePay.");
    }
  }

  async createCheckout(input: CreatePaymentCheckoutInput): Promise<CreatedPaymentCheckout> {
    const configuredWebhook = this.config.get<string>("INFINITEPAY_WEBHOOK_URL");
    const apiUrl = (this.config.get<string>("API_URL") ?? "http://localhost:3001").replace(/\/+$/, "");
    const secret = this.config.get<string>("INFINITEPAY_WEBHOOK_SECRET");
    // Nest exposes controllers below the global /api prefix in production.
    const webhookUrl = configuredWebhook ?? `${apiUrl}/api/webhooks/infinitepay${secret ? `?secret=${encodeURIComponent(secret)}` : ""}`;
    const buyerPhone = this.formatBrazilianPhone(input.buyerPhone);
    const response = await this.request<InfinitePayLink>("/links", {
      handle: this.handle,
      items: [{ quantity: 1, price: input.amountCents, description: input.description }],
      order_nsu: input.orderId,
      redirect_url: input.returnUrl,
      webhook_url: webhookUrl,
      customer: {
        name: input.buyerName,
        email: input.buyerEmail,
        ...(buyerPhone ? { phone_number: buyerPhone } : {})
      }
    });
    const checkoutUrl = response.url ?? response.checkout_url;
    if (!checkoutUrl) throw new InternalServerErrorException("InfinitePay nao retornou a URL do checkout.");
    const checkoutId = response.invoice_slug ?? response.slug;
    return {
      provider: this.id,
      providerRef: response.transaction_nsu ?? checkoutId ?? input.orderId,
      checkoutId,
      transactionId: response.transaction_nsu,
      checkoutUrl
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerification> {
    const transactionNsu = input.transactionId ?? input.providerRef;
    const slug = input.checkoutId;
    if (!transactionNsu || !slug) {
      return { id: input.orderId, status: "PENDING" };
    }
    const response = await this.request<InfinitePayStatus>("/payment_check", {
      handle: this.handle,
      order_nsu: input.orderId,
      transaction_nsu: transactionNsu,
      slug
    });
    return {
      id: transactionNsu,
      status: response.paid ? "PAID" : "PENDING",
      amountCents: response.amount,
      paidAmountCents: response.paid_amount,
      paymentMethod: response.capture_method,
      providerRef: transactionNsu,
      checkoutId: slug,
      transactionId: transactionNsu
    };
  }

  private formatBrazilianPhone(phone?: string) {
    const digits = phone?.replace(/\D/g, "");
    if (!digits) return undefined;
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
    if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
    return undefined;
  }
}
