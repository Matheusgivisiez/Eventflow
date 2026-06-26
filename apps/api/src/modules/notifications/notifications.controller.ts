import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { NotificationEvent, NotificationType, Prisma, UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notificacoes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  send(@Body() body: { userId?: string; type: NotificationType; event: NotificationEvent; recipient: string; payload: Prisma.InputJsonValue }) {
    return this.notifications.send(body);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  list(@Query() query: { userId?: string; event?: NotificationEvent; type?: NotificationType }) {
    return this.notifications.list(query);
  }
}
