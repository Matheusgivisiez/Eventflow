import { Global, Module } from "@nestjs/common";
import { BusinessMetricsService } from "./business-metrics.service";

@Global()
@Module({
  providers: [BusinessMetricsService],
  exports: [BusinessMetricsService]
})
export class ObservabilityModule {}
