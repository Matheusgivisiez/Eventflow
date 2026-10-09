import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PaymentStatus, UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AdminService } from "./admin.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequestUser } from "../../common/types/request-user";
import { UpdateEventDto } from "../events/dto/update-event.dto";
import { CreateTicketTypeDto } from "../tickets/dto/create-ticket-type.dto";
import { UpdateTicketTypeDto } from "../tickets/dto/update-ticket-type.dto";

@ApiTags("Administração")
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("users")
  users() {
    return this.admin.users();
  }

  @Get("users-page")
  usersPage(@Query("search") search?: string, @Query("page") page?: string) {
    return this.admin.usersPage(search, page);
  }

  @Get("users/:id")
  user(@Param("id") id: string) {
    return this.admin.user(id);
  }

  @Get("events")
  events() {
    return this.admin.events();
  }

  @Get("events-page")
  eventsPage(@Query("search") search?: string, @Query("page") page?: string) {
    return this.admin.eventsPage(search, page);
  }

  @Get("event-options")
  eventOptions() {
    return this.admin.eventOptions();
  }

  @Get("events/:id")
  event(@Param("id") id: string) {
    return this.admin.event(id);
  }

  @Get("events/:id/manage")
  manageEvent(@Param("id") id: string) {
    return this.admin.manageEvent(id);
  }

  @Patch("events/:id/manage")
  updateManagedEvent(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateEventDto) {
    return this.admin.updateManagedEvent(id, dto, user.id);
  }

  @Post("events/:id/invite-link")
  createManagedInviteLink(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.admin.createManagedInviteLink(id, user.id);
  }

  @Get("events/:id/ticket-types")
  managedTicketTypes(@Param("id") id: string) {
    return this.admin.managedTicketTypes(id);
  }

  @Post("events/:id/ticket-types")
  createManagedTicketType(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CreateTicketTypeDto) {
    return this.admin.createManagedTicketType(id, dto, user.id);
  }

  @Patch("events/:id/ticket-types/:ticketId")
  updateManagedTicketType(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("ticketId") ticketId: string, @Body() dto: UpdateTicketTypeDto) {
    return this.admin.updateManagedTicketType(id, ticketId, dto, user.id);
  }

  @Delete("events/:id/ticket-types/:ticketId")
  removeManagedTicketType(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("ticketId") ticketId: string) {
    return this.admin.removeManagedTicketType(id, ticketId, user.id);
  }

  @Get("payments")
  payments(@Query("status") status?: PaymentStatus) {
    return this.admin.payments(status);
  }

  @Get("payments-page")
  paymentsPage(@Query("status") status?: string, @Query("eventId") eventId?: string, @Query("page") page?: string) {
    if (status && !Object.values(PaymentStatus).includes(status as PaymentStatus)) {
      throw new BadRequestException("Status de pagamento inválido.");
    }
    return this.admin.paymentsPage(status as PaymentStatus | undefined, eventId, page);
  }

  @Get("logs")
  logs() {
    return this.admin.logs();
  }
}
