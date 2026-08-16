import { Controller, Get, Header } from "@nestjs/common";
import { BusinessMetricsService } from "./modules/observability/business-metrics.service";

@Controller()
export class AppController {
  constructor(private readonly metricsService: BusinessMetricsService) {}

  @Get("health")
  health() {
    return { status: "ok", service: "eventflow-api" };
  }

  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4")
  metrics() {
    return this.metricsService.renderPrometheus();
  }
}
