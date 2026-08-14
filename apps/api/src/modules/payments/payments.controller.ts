import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { PaymentStatus } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { UpdatePaymentStatusDto } from "./dto/update-payment-status.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("Pagamentos")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: { page?: string; perPage?: string; status?: PaymentStatus }) {
    return this.payments.list(user.tenantId!, query);
  }

  @Post("orders/:orderId/preference")
  @Throttle({ checkout: { limit: 30, ttl: 60000 } })
  createPreference(@Param("orderId") orderId: string) {
    return this.payments.createProviderPreference(orderId);
  }

  @Patch(":id/status")
  @Throttle({ sensitive: { limit: 20, ttl: 60000 } })
  updateStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePaymentStatusDto) {
    return this.payments.updateStatus(id, user.tenantId!, dto);
  }
}
