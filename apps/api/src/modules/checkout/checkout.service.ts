import { Injectable } from "@nestjs/common";
import { RequestUser } from "../../common/types/request-user";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";
import { CreateCheckoutUseCase } from "./use-cases/create-checkout.use-case";

@Injectable()
export class CheckoutService {
  constructor(private readonly createCheckout: CreateCheckoutUseCase) {}

  create(slug: string, dto: CreateCheckoutDto, user?: RequestUser) {
    return this.createCheckout.execute(slug, dto, user);
  }
}
