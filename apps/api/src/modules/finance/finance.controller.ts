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

// Every route here reads or moves an organization's money. CUSTOMER/PROMOTER
// accounts have no tenant, and `user.tenantId!` would otherwise coerce that
// null into a query that matches every other tenant-less account's ledger.
@ApiTags("Financeiro")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER, UserRole.ADMIN)
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

  @Get("withdrawals")
  listWithdrawals(@CurrentUser() user: RequestUser) {
    return this.finance.listWithdrawals(requireTenant(user));
  }

  /** Admin-only: approve a pending withdrawal and dispatch AbacatePay PIX */
  @Post("withdrawals/:id/approve")
  @Roles(UserRole.ADMIN)
  approveWithdrawal(@Param("id") id: string, @Body() dto: ApproveWithdrawalDto) {
    return this.finance.approveWithdrawal(id, dto);
  }
}
