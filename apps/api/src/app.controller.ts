import { Controller, Get, Header } from "@nestjs/common";
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
  metrics() {
    return this.metricsService.renderPrometheus();
  }
}
