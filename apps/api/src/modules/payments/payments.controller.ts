import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { PaymentStatus, UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequestUser } from "../../common/types/request-user";
import { UpdatePaymentStatusDto } from "./dto/update-payment-status.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("Pagamentos")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: { page?: string; perPage?: string; status?: PaymentStatus }) {
    return this.payments.list(user.tenantId!, query);
  }

  @Post("orders/:orderId/preference")
  @Throttle({ checkout: { limit: 30, ttl: 60000 } })
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  createPreference(@CurrentUser() user: RequestUser, @Param("orderId") orderId: string) {
    return this.payments.createProviderPreference(orderId, user.role === UserRole.ADMIN ? undefined : user.tenantId);
  }

  @Patch(":id/status")
  @Throttle({ sensitive: { limit: 20, ttl: 60000 } })
  @Roles(UserRole.ADMIN)
  updateStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePaymentStatusDto) {
    return this.payments.updateStatus(id, user.tenantId!, dto);
  }
}
