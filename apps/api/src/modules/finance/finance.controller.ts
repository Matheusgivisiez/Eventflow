import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequestUser } from "../../common/types/request-user";
import { requireTenant } from "../../common/utils/require-tenant";
import { ApproveWithdrawalDto } from "./dto/approve-withdrawal.dto";
import { RequestWithdrawalDto } from "./dto/request-withdrawal.dto";
import { FinanceService } from "./finance.service";

// Access is unchanged: any authenticated account that belongs to an
// organization (ORGANIZER, ADMIN, TEAM, CHECKIN) keeps using these routes.
// The only difference is that an account with no tenant (CUSTOMER/PROMOTER)
// is refused instead of reaching a query built from `tenantId: null`.
@ApiTags("Financeiro")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("finance")
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("summary")
  summary(@CurrentUser() user: RequestUser) {
    return this.finance.summary(requireTenant(user));
  }

  @Get("statement")
  statement(@CurrentUser() user: RequestUser) {
    return this.finance.statement(requireTenant(user));
  }

  @Post("withdrawals")
  requestWithdrawal(@CurrentUser() user: RequestUser, @Body() dto: RequestWithdrawalDto) {
    return this.finance.requestWithdrawal(requireTenant(user), dto);
  }

  // The admin panel uses this same route to list withdrawals awaiting
  // approval, so ADMIN keeps the original behavior (its own tenant, or every
  // tenant when the admin account has none). Everyone else must have a tenant:
  // before, a CUSTOMER with `tenantId: null` fell into the "no filter" branch
  // and received every organization's withdrawals.
  @Get("withdrawals")
  listWithdrawals(@CurrentUser() user: RequestUser) {
    const tenantId = user.role === UserRole.ADMIN ? user.tenantId ?? undefined : requireTenant(user);
    return this.finance.listWithdrawals(tenantId);
  }

  /** Admin-only: approve a pending withdrawal and dispatch AbacatePay PIX */
  @Post("withdrawals/:id/approve")
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  approveWithdrawal(@Param("id") id: string, @Body() dto: ApproveWithdrawalDto) {
    return this.finance.approveWithdrawal(id, dto);
  }
}
