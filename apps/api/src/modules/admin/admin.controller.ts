import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PaymentStatus, UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AdminService } from "./admin.service";

@ApiTags("Administracao")
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("users")
  users() {
    return this.admin.users();
  }

  @Get("events")
  events() {
    return this.admin.events();
  }

  @Get("payments")
  payments(@Query("status") status?: PaymentStatus) {
    return this.admin.payments(status);
  }

  @Get("logs")
  logs() {
    return this.admin.logs();
  }
}
