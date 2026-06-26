import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequestUser } from "../../common/types/request-user";
import { AddMemberDto } from "./dto/add-member.dto";
import { UpdatePermissionsDto } from "./dto/update-permissions.dto";
import { TeamService } from "./team.service";

@ApiTags("Team")
@Controller("team")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Post()
  addMember(@CurrentUser() user: RequestUser, @Body() dto: AddMemberDto) {
    return this.team.addMember(user.tenantId!, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.team.list(user.tenantId!);
  }

  @Patch(":id")
  updatePermissions(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePermissionsDto) {
    return this.team.updatePermissions(id, user.tenantId!, dto);
  }

  @Delete(":id")
  removeMember(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.team.removeMember(id, user.tenantId!);
  }
}
