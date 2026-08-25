import { Controller, Get, Param, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Response } from "express";
import { PromotersService } from "./promoters.service";

/**
 * Public endpoint for promoter link click tracking.
 * No authentication required — accessible by any visitor.
 * Increments the click counter and redirects to the event checkout page.
 */
@ApiTags("Promoters")
@Controller("p")
export class PromoterTrackController {
  constructor(private readonly promoters: PromotersService) {}

  @Get(":code")
  @SkipThrottle()
  @ApiOperation({ summary: "Rastreia clique em link de promoter e redireciona para o evento" })
  async track(@Param("code") code: string, @Res() res: Response) {
    try {
      const { eventSlug } = await this.promoters.trackClick(code);
      // Redirect to the event checkout page with the promoter code attached
      return res.redirect(302, `/checkout/${eventSlug}?p=${encodeURIComponent(code)}`);
    } catch {
      // If link not found, redirect to home
      return res.redirect(302, "/");
    }
  }
}
