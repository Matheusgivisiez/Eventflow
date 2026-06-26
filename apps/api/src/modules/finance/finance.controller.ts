import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
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
}
