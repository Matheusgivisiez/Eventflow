import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";

@ApiTags("Checkout")
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post(":slug")
  @ApiOperation({ summary: "Criar um novo pedido (checkout)", description: "Inicia o processo de compra para um evento pelo slug." })
  create(@Param("slug") slug: string, @Body() dto: CreateCheckoutDto) {
    return this.checkout.create(slug, dto);
  }
}
