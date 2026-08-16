import { BusinessMetricsService } from "./business-metrics.service";

describe("BusinessMetricsService", () => {
  it("renders default and business counters in Prometheus format without PII labels", () => {
    const metrics = new BusinessMetricsService();

    metrics.increment("eventflow_checkout_created_total", { tenant: "tenant-1", method: "PIX" });
    metrics.increment("eventflow_checkout_created_total", { tenant: "tenant-1", method: "PIX" });
    metrics.increment("eventflow_checkin_validations_total", { status: "ENTERED" });

    const output = metrics.renderPrometheus();

    expect(output).toContain("# TYPE eventflow_api_up gauge");
    expect(output).toContain('eventflow_checkout_created_total{method="PIX",tenant="tenant-1"} 2');
    expect(output).toContain('eventflow_checkin_validations_total{status="ENTERED"} 1');
    expect(output).not.toContain("email");
    expect(output).not.toContain("token");
  });
});
