import { Injectable } from "@nestjs/common";

export type MercadoPagoPreferenceInput = {
  orderId: string;
  amountCents: number;
  buyerEmail: string;
  description: string;
};

@Injectable()
export class MercadoPagoGateway {
  async createPreference(input: MercadoPagoPreferenceInput) {
    return {
      provider: "mercado_pago",
      providerRef: `mp_pref_${input.orderId}`,
      checkoutUrl: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=mp_pref_${input.orderId}`
    };
  }
}
