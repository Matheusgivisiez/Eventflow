import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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

  @Get("profile")
  @Roles(UserRole.PROMOTER)
  @ApiOperation({ summary: "Retorna o perfil do promoter autenticado" })
  getProfile(@CurrentUser() user: RequestUser) {
    return this.portal.getProfile(user.id);
  }

  @Patch("profile")
  @Roles(UserRole.PROMOTER)
  @ApiOperation({ summary: "Atualiza o perfil do promoter (pixKey, instagram, cidade, estado)" })
  updateProfile(@CurrentUser() user: RequestUser, @Body() body: { pixKey?: string; instagram?: string; city?: string; state?: string }) {
    return this.portal.updateProfile(user.id, body);
  }

  @Get("dashboard")
  @Roles(UserRole.PROMOTER)
  @ApiOperation({ summary: "Retorna o dashboard do promoter com estatísticas reais de pedidos PAGOS" })
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.portal.getDashboard(user.id);
  }

  @Get("sales")
  @Roles(UserRole.PROMOTER)
  @ApiOperation({ summary: "Retorna histórico de vendas confirmadas do promoter" })
  getSales(@CurrentUser() user: RequestUser) {
    return this.portal.getSales(user.id);
  }

  @Get("withdrawals")
  @Roles(UserRole.PROMOTER)
  @ApiOperation({ summary: "Retorna o histórico de saques do promoter" })
  getWithdrawals(@CurrentUser() user: RequestUser) {
    return this.portal.getWithdrawals(user.id);
  }

  @Post("withdrawals")
  @Roles(UserRole.PROMOTER)
  @ApiOperation({ summary: "Solicita um saque do saldo de comissões" })
  requestWithdrawal(@CurrentUser() user: RequestUser, @Body("amountCents") amountCents: number) {
    return this.portal.requestWithdrawal(user.id, amountCents);
  }
}
