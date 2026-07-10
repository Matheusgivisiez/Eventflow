import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequestUser } from "../../common/types/request-user";
import { PromoterPortalService } from "./promoter-portal.service";

@ApiTags("Promoter Portal")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("promoter-portal")
export class PromoterPortalController {
  constructor(private readonly portal: PromoterPortalService) {}

  @Get("dashboard")
  @Roles(UserRole.PROMOTER)
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.portal.getDashboard(user.id);
  }

  @Get("sales")
  @Roles(UserRole.PROMOTER)
  getSales(@CurrentUser() user: RequestUser) {
    return this.portal.getSales(user.id);
  }

  @Get("withdrawals")
  @Roles(UserRole.PROMOTER)
  getWithdrawals(@CurrentUser() user: RequestUser) {
    return this.portal.getWithdrawals(user.id);
  }

  @Post("withdrawals")
  @Roles(UserRole.PROMOTER)
  requestWithdrawal(@CurrentUser() user: RequestUser, @Body("amountCents") amountCents: number) {
    return this.portal.requestWithdrawal(user.id, amountCents);
  }
}
