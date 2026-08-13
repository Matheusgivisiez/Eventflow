import { Injectable } from "@nestjs/common";
import { RequestUser } from "../../common/types/request-user";
import { PaymentsService } from "../payments/payments.service";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";
import { CreateCheckoutUseCase } from "./use-cases/create-checkout.use-case";

@Injectable()
export class CheckoutService {
  constructor(
    private readonly createCheckout: CreateCheckoutUseCase,
    private readonly payments: PaymentsService
  ) {}

  async create(slug: string, dto: CreateCheckoutDto, user?: RequestUser) {
    const order = await this.createCheckout.execute(slug, dto, user);
    const checkout = await this.payments.createProviderPreference(order.id);

    return {
      ...order,
      orderId: order.id,
      status: order.status,
      checkoutUrl: checkout.checkoutUrl
    };
  }
}
