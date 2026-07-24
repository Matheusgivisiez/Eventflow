import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequestUser } from "../../common/types/request-user";
import { ApproveWithdrawalDto } from "./dto/approve-withdrawal.dto";
import { RequestWithdrawalDto } from "./dto/request-withdrawal.dto";
import { FinanceService } from "./finance.service";

@ApiTags("Financeiro")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("finance")
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("summary")
  summary(@CurrentUser() user: RequestUser) {
    return this.finance.summary(user.tenantId!);
  }

  @Get("statement")
  statement(@CurrentUser() user: RequestUser) {
    return this.finance.statement(user.tenantId!);
  }

  @Post("withdrawals")
  requestWithdrawal(@CurrentUser() user: RequestUser, @Body() dto: RequestWithdrawalDto) {
    return this.finance.requestWithdrawal(user.tenantId!, dto);
  }

  @Get("withdrawals")
  listWithdrawals(@CurrentUser() user: RequestUser) {
    return this.finance.listWithdrawals(user.tenantId!);
  }

  /** Admin-only: approve a pending withdrawal and dispatch AbacatePay PIX */
  @Post("withdrawals/:id/approve")
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  approveWithdrawal(@Param("id") id: string, @Body() dto: ApproveWithdrawalDto) {
    return this.finance.approveWithdrawal(id, dto);
  }
}

