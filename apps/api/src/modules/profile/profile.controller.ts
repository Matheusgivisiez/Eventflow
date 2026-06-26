import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { ChangePasswordDto, UpdateProfileDto } from "./dto/update-profile.dto";
import { ProfileService } from "./profile.service";

@ApiTags("Perfil")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Patch()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.profile.update(user.id, user.tenantId!, dto);
  }

  @Patch("password")
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    return this.profile.changePassword(user.id, dto);
  }

  @Get("tickets")
  myTickets(@CurrentUser() user: RequestUser) {
    return this.profile.myTickets(user.email);
  }
}
