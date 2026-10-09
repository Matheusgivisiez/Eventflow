import { Body, Controller, Get, Header, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import type { RequestUser } from "../../common/types/request-user";
import { PendingPurchasesService } from "./pending-purchases.service";

class ResumePurchaseDto {
  @IsOptional()
  @IsString()
  accessToken?: string;
}

@Controller()
export class PendingPurchasesController {
  constructor(private readonly pending: PendingPurchasesService) {}

  @Get("buyer/pending-orders")
  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  list(@CurrentUser() user: RequestUser) {
    return this.pending.list(user);
  }

  @Post("checkout/order/:orderId/resume")
  @UseGuards(OptionalJwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @Throttle({ sensitive: { limit: 10, ttl: 60000 } })
  resume(@Param("orderId") orderId: string, @Body() dto: ResumePurchaseDto, @CurrentUser() user?: RequestUser) {
    return this.pending.resume(orderId, user, dto.accessToken);
  }
}
