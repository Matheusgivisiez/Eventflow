import { Injectable } from "@nestjs/common";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";
import { CreateCheckoutUseCase } from "./use-cases/create-checkout.use-case";

@Injectable()
export class CheckoutService {
  constructor(private readonly createCheckout: CreateCheckoutUseCase) {}

  create(slug: string, dto: CreateCheckoutDto) {
    return this.createCheckout.execute(slug, dto);
  }
}
