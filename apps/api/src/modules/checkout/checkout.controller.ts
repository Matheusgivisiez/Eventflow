import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
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
  @Throttle({ checkout: { limit: 30, ttl: 60000 } })
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Criar um novo pedido (checkout)", description: "Inicia o processo de compra para um evento pelo slug." })
  create(@Param("slug") slug: string, @Body() dto: CreateCheckoutDto, @CurrentUser() user?: RequestUser) {
    return this.checkout.create(slug, dto, user);
  }

  @Get("order/:orderId")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: "Consultar status público de um pedido", description: "Permite que compradores consultem o status e ingressos do seu pedido sem login." })
  getOrderStatus(@Param("orderId") orderId: string, @Query("accessToken") accessToken?: string) {
    return this.checkout.getOrderStatus(orderId, accessToken);
  }

  @Post("order/:orderId/confirm-simulation")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Confirmar pagamento simulado no sandbox" })
  confirmSimulation(@Param("orderId") orderId: string, @Query("accessToken") accessToken?: string) {
    return this.checkout.confirmSimulation(orderId, accessToken);
  }
}
