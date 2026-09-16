import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequestUser } from "../../common/types/request-user";
import { requireTenant } from "../../common/utils/require-tenant";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("Usuarios")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Lists and edits other accounts within the caller's own organization only.
  // A user with no tenant (CUSTOMER/PROMOTER) must never reach these: their
  // tenantId is null, and a null filter would otherwise match every account
  // on the platform that also has no tenant.
  @Get()
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  list(@CurrentUser() user: RequestUser) {
    return this.users.list(requireTenant(user));
  }

  @Patch("me")
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Patch(":id")
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, requireTenant(user), dto);
  }
}
