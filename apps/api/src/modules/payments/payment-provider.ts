export type PaymentProviderId = "abacate_pay" | "infinite_pay";

export type CreatePaymentCheckoutInput = {
  orderId: string;
  amountCents: number;
  buyerEmail: string;
  buyerName: string;
  buyerDocument?: string;
  buyerPhone?: string;
  description: string;
  returnUrl: string;
  completionUrl: string;
  paymentMethod?: string;
};

export type CreatedPaymentCheckout = {
  provider: PaymentProviderId;
  providerRef: string;
  checkoutId?: string;
  billId?: string;
  transactionId?: string;
  checkoutUrl: string;
};

export type VerifiedPaymentStatus = "PENDING" | "PAID" | "CANCELED" | "REFUNDED";

export type PaymentVerification = {
  id: string;
  status: VerifiedPaymentStatus;
  amountCents?: number;
  paidAmountCents?: number;
  paymentMethod?: string;
  providerRef?: string;
  checkoutId?: string;
  transactionId?: string;
};

export type VerifyPaymentInput = {
  orderId: string;
  providerRef?: string | null;
  checkoutId?: string | null;
  transactionId?: string | null;
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createCheckout(input: CreatePaymentCheckoutInput): Promise<CreatedPaymentCheckout>;
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerification>;
}
