import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { TransferStatus } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { CreateTransferDto, ResolveTransferRecipientDto } from "./dto/create-transfer.dto";
import { TransfersService } from "./transfers.service";

@ApiTags("Transferencias de ingressos")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Post("recipient")
  @Throttle({ sensitive: { limit: 20, ttl: 60000 } })
  resolveRecipient(@CurrentUser() user: RequestUser, @Body() dto: ResolveTransferRecipientDto) {
    return this.transfers.resolveRecipient(user, dto);
  }

  @Post()
  @Throttle({ sensitive: { limit: 5, ttl: 60000 } })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTransferDto) {
    return this.transfers.create(user, dto);
  }

  @Get()
  received(@CurrentUser() user: RequestUser, @Query() query: { page?: string; perPage?: string; status?: TransferStatus }) {
    return this.transfers.received(user, query);
  }

  @Get("sent")
  sent(@CurrentUser() user: RequestUser, @Query() query: { page?: string; perPage?: string; status?: TransferStatus }) {
    return this.transfers.sent(user, query);
  }

  @Get("history")
  history(@CurrentUser() user: RequestUser, @Query() query: { page?: string; perPage?: string }) {
    return this.transfers.history(user, query);
  }

  @Get("all")
  all(@CurrentUser() user: RequestUser, @Query() query: { page?: string; perPage?: string; status?: TransferStatus }) {
    return this.transfers.all(user, query);
  }

  @Post(":id/accept")
  @Throttle({ sensitive: { limit: 15, ttl: 60000 } })
  accept(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.transfers.accept(user, id);
  }

  @Post(":id/reject")
  @Throttle({ sensitive: { limit: 15, ttl: 60000 } })
  reject(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.transfers.reject(user, id);
  }

  @Post(":id/cancel")
  @Throttle({ sensitive: { limit: 15, ttl: 60000 } })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.transfers.cancel(user, id);
  }
}
