import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequestUser } from "../../common/types/request-user";
import { CouponsService } from "./coupons.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@ApiTags("Coupons")
@Controller("coupons")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER, UserRole.TEAM)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCouponDto) {
    // Admin creates global coupons (tenantId = null).
    const tenantId = user.role === UserRole.ADMIN ? null : user.tenantId;
    return this.coupons.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER, UserRole.TEAM)
  list(@CurrentUser() user: RequestUser) {
    const tenantId = user.role === UserRole.ADMIN ? null : user.tenantId;
    return this.coupons.list(tenantId);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER, UserRole.TEAM)
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCouponDto) {
    const tenantId = user.role === UserRole.ADMIN ? null : user.tenantId;
    return this.coupons.update(id, tenantId, dto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER, UserRole.TEAM)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    const tenantId = user.role === UserRole.ADMIN ? null : user.tenantId;
    return this.coupons.remove(id, tenantId);
  }
}
