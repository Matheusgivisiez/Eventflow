import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { NodeSDK } from "@opentelemetry/sdk-node";

const { endpoint = "0.0.0.0:9464", prefix = "eventhub_" } = process.env;

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
  metricReader: new PrometheusExporter({ endpoint, prefix })
});

process.on("SIGTERM", () => {
  sdk.shutdown().catch(() => undefined);
});

export async function initTelemetry() {
  try {
    await sdk.start();
    diag.info("OpenTelemetry initialized");
  } catch (error) {
    diag.error("Failed to initialize OpenTelemetry", error);
  }
}
