import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PromoterStatus, UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequestUser } from "../../common/types/request-user";
import { PromotersService } from "./promoters.service";

@ApiTags("Promoters")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("promoters")
export class PromotersController {
  constructor(private readonly promoters: PromotersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  list(@CurrentUser() user: RequestUser) {
    return this.promoters.list(user.tenantId!);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  create(@CurrentUser() user: RequestUser, @Body() body: any) {
    return this.promoters.create(user.tenantId!, body);
  }

  @Patch(":id/status")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  updateStatus(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body("status") status: PromoterStatus) {
    return this.promoters.updateStatus(user.tenantId!, id, status);
  }

  @Get("events/:eventId/links")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  listEventLinks(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string) {
    return this.promoters.listEventLinks(user.tenantId!, eventId);
  }

  @Post("events/:eventId/links")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  addPromoterToEvent(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() body: any) {
    return this.promoters.addPromoterToEvent(user.tenantId!, eventId, body);
  }

  @Get("withdrawals")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  withdrawals(@CurrentUser() user: RequestUser) {
    return this.promoters.withdrawals(user.tenantId!);
  }
}
