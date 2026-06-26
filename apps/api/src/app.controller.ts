import { Controller, Get, Header } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("health")
  health() {
    return { status: "ok", service: "eventhub-api" };
  }

  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4")
  metrics() {
    return [
      "# HELP eventhub_api_up EventHub API availability",
      "# TYPE eventhub_api_up gauge",
      "eventhub_api_up 1",
      "# HELP eventhub_enterprise_modules Enterprise modules enabled",
      "# TYPE eventhub_enterprise_modules gauge",
      "eventhub_enterprise_modules 12"
    ].join("\n");
  }
}
