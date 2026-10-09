import { Controller, Get, Header, Param, Query, Res, StreamableFile } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { BuyerService } from "./buyer.service";

@Controller("vip-ticket-download")
export class VipTicketDownloadController {
  constructor(private readonly buyer: BuyerService) {}

  @Get(":ticketId")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async pdf(
    @Param("ticketId") ticketId: string,
    @Query("token") token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const buffer = await this.buyer.vipTicketPdf(ticketId, token ?? "");
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="eventflow-vip-${ticketId}.pdf"`);
    return new StreamableFile(buffer);
  }
}
