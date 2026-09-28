import { Controller, Get, Header, Headers, NotFoundException } from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { SkipThrottle } from "@nestjs/throttler";
import { MailService } from "./common/services/mail.service";
import { BusinessMetricsService } from "./modules/observability/business-metrics.service";

@Controller()
export class AppController {
  constructor(
    private readonly metricsService: BusinessMetricsService,
    private readonly mailService: MailService
  ) {}

  @Get("health")
  @SkipThrottle()
  health() {
    const mail = this.mailService.getCachedTransportHealth();
    void this.mailService.refreshTransportHealth().catch(() => undefined);

    return {
      status: "ok",
      service: "eventflow-api",
      mail
    };
  }

  @Get("metrics")
  @SkipThrottle()
  @Header("Content-Type", "text/plain; version=0.0.4")
  metrics(@Headers("authorization") authorization?: string) {
    // Em producao so responde com METRICS_TOKEN configurado e enviado como
    // "Bearer <token>"; sem isso a rota finge nao existir (404).
    if (process.env.NODE_ENV === "production") {
      const token = process.env.METRICS_TOKEN;
      const expected = token ? Buffer.from(`Bearer ${token}`) : null;
      const received = Buffer.from(authorization ?? "");
      if (!expected || expected.length !== received.length || !timingSafeEqual(expected, received)) {
        throw new NotFoundException();
      }
    }
    return this.metricsService.renderPrometheus();
  }
}
