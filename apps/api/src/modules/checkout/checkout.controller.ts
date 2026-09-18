import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { CouponsService } from "../coupons/coupons.service";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";
import { PreviewCouponDto } from "./dto/preview-coupon.dto";

@ApiTags("Checkout")
@Controller("checkout")
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly coupons: CouponsService
  ) {}

  @Post(":slug/coupon")
  // Limite baixo: evita que alguem fique chutando codigos de cupom.
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Validar cupom no checkout", description: "Confere se o cupom vale para o evento e retorna o desconto. Nao consome uso." })
  previewCoupon(@Param("slug") slug: string, @Body() dto: PreviewCouponDto) {
    return this.coupons.previewForEvent(slug, dto.code);
  }

  @Post(":slug")
  @Throttle({ default: { limit: 300, ttl: 60000 }, checkout: { limit: 300, ttl: 60000 } })
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Criar um novo pedido (checkout)", description: "Inicia o processo de compra para um evento pelo slug." })
  create(@Param("slug") slug: string, @Body() dto: CreateCheckoutDto, @CurrentUser() user?: RequestUser) {
    return this.checkout.create(slug, dto, user);
  }

  @Get("order/:orderId")
  @Throttle({ default: { limit: 600, ttl: 60000 } })
  @ApiOperation({ summary: "Consultar status público de um pedido", description: "Permite que compradores consultem o status e ingressos do seu pedido sem login." })
  getOrderStatus(
    @Param("orderId") orderId: string,
    @Query("accessToken") accessToken?: string,
    @Query("slug") slug?: string,
    @Query("invoice_slug") invoiceSlug?: string,
    @Query("transaction_nsu") transactionNsu?: string
  ) {
    return this.checkout.getOrderStatus(orderId, accessToken, {
      checkoutId: invoiceSlug ?? slug,
      transactionId: transactionNsu
    });
  }

  @Get("order/:orderId/tickets/:ticketId/pdf")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: "Baixar o PDF de um ingresso sem login", description: "Rota publica, autorizada pelo token de acesso do pedido (o mesmo usado no link do e-mail de confirmacao)." })
  async ticketPdf(
    @Param("orderId") orderId: string,
    @Param("ticketId") ticketId: string,
    @Query("accessToken") accessToken: string | undefined,
    @Res({ passthrough: true }) response: Response
  ) {
    const buffer = await this.checkout.ticketPdf(orderId, ticketId, accessToken);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="eventflow-ticket-${ticketId}.pdf"`);
    return new StreamableFile(buffer);
  }

  @Post("order/:orderId/confirm-simulation")
  @Throttle({ default: { limit: 600, ttl: 60000 }, checkout: { limit: 600, ttl: 60000 } })
  @ApiOperation({ summary: "Confirmar pagamento simulado no sandbox" })
  confirmSimulation(@Param("orderId") orderId: string, @Query("accessToken") accessToken?: string) {
    return this.checkout.confirmSimulation(orderId, accessToken);
  }
}
