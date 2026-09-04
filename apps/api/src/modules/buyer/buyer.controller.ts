import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { BuyerService } from "./buyer.service";
import { RequestRefundDto } from "./dto/request-refund.dto";

@ApiTags("Area do comprador")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("buyer")
export class BuyerController {
  constructor(private readonly buyer: BuyerService) {}

  @Get("tickets")
  tickets(@CurrentUser() user: RequestUser, @Query("scope") scope?: "future" | "past") {
    return this.buyer.listTickets(user.id, user.email, scope);
  }

  @Post("tickets/:id/refund")
  @Throttle({ sensitive: { limit: 5, ttl: 60000 } })
  refund(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: RequestRefundDto) {
    return this.buyer.requestRefund(user.id, user.email, id, dto.password);
  }

  @Get("tickets/:id/pdf")
  async pdf(@CurrentUser() user: RequestUser, @Param("id") id: string, @Res({ passthrough: true }) response: Response) {
    const buffer = await this.buyer.ticketPdf(user.id, user.email, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="eventflow-ticket-${id}.pdf"`);
    return new StreamableFile(buffer);
  }

  @Get("tickets/:id/google-wallet")
  googleWallet(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.buyer.walletPayload(user.id, user.email, id, "google");
  }

  @Get("tickets/:id/apple-wallet")
  appleWallet(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.buyer.walletPayload(user.id, user.email, id, "apple");
  }
}
