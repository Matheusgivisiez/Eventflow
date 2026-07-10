import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";

@ApiTags("Checkout")
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post(":slug")
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Criar um novo pedido (checkout)", description: "Inicia o processo de compra para um evento pelo slug." })
  create(@Param("slug") slug: string, @Body() dto: CreateCheckoutDto, @CurrentUser() user?: RequestUser) {
    return this.checkout.create(slug, dto, user);
  }
}
