import { Controller, Get, Header, Param, Query, Res, StreamableFile } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { BuyerService } from "./buyer.service";

@Controller("transfer-ticket-download")
export class TransferTicketDownloadController {
  constructor(private readonly buyer: BuyerService) {}

  @Get(":transferId")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async pdf(
    @Param("transferId") transferId: string,
    @Query("token") token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const buffer = await this.buyer.transferredTicketPdf(transferId, token ?? "");
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="eventflow-ingresso-${transferId}.pdf"`);
    return new StreamableFile(buffer);
  }
}
