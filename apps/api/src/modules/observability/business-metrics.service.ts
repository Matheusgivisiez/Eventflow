import { Injectable } from "@nestjs/common";

type MetricLabels = Record<string, string | number | boolean | undefined>;

type MetricSample = {
  name: string;
  help: string;
  labels: Record<string, string>;
  value: number;
};

const METRIC_HELP: Record<string, string> = {
  eventflow_api_up: "Event Flow API availability",
  eventflow_enterprise_modules: "Enterprise modules enabled",
  eventflow_checkout_created_total: "Checkout orders created",
  eventflow_checkout_inventory_conflicts_total: "Checkout inventory reservation conflicts",
  eventflow_payment_status_transitions_total: "Payment status transitions",
  eventflow_payment_tickets_emitted_total: "Tickets emitted after payment approval",
  eventflow_webhooks_received_total: "Payment webhooks received",
  eventflow_webhooks_processed_total: "Payment webhooks processed",
  eventflow_webhooks_duplicates_total: "Duplicate payment webhooks ignored",
  eventflow_webhooks_unmatched_total: "Payment webhooks that could not be matched",
  eventflow_checkin_validations_total: "Check-in validation outcomes",
  eventflow_checkin_signature_failures_total: "Forged or invalid check-in QR signatures"
};

@Injectable()
export class BusinessMetricsService {
  private readonly counters = new Map<string, MetricSample>();

  constructor() {
    this.setGauge("eventflow_api_up", 1);
    this.setGauge("eventflow_enterprise_modules", 12);
  }

  increment(name: keyof typeof METRIC_HELP, labels: MetricLabels = {}, value = 1) {
    const key = this.key(name, labels);
    const existing = this.counters.get(key);

    if (existing) {
      existing.value += value;
      return;
    }

    this.counters.set(key, {
      name,
      help: METRIC_HELP[name],
      labels: this.normalizeLabels(labels),
      value
    });
  }

  setGauge(name: keyof typeof METRIC_HELP, value: number, labels: MetricLabels = {}) {
    this.counters.set(this.key(name, labels), {
      name,
      help: METRIC_HELP[name],
      labels: this.normalizeLabels(labels),
      value
    });
  }

  renderPrometheus() {
    const grouped = new Map<string, MetricSample[]>();
    for (const sample of this.counters.values()) {
      grouped.set(sample.name, [...(grouped.get(sample.name) ?? []), sample]);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([name, samples]) => [
        `# HELP ${name} ${METRIC_HELP[name]}`,
        `# TYPE ${name} ${name.endsWith("_total") ? "counter" : "gauge"}`,
        ...samples
          .sort((a, b) => this.formatLabels(a.labels).localeCompare(this.formatLabels(b.labels)))
          .map((sample) => `${sample.name}${this.formatLabels(sample.labels)} ${sample.value}`)
      ])
      .join("\n");
  }

  private key(name: string, labels: MetricLabels) {
    return `${name}:${JSON.stringify(this.normalizeLabels(labels))}`;
  }

  private normalizeLabels(labels: MetricLabels) {
    return Object.fromEntries(
      Object.entries(labels)
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, String(value)])
    );
  }

  private formatLabels(labels: Record<string, string>) {
    const entries = Object.entries(labels);
    if (!entries.length) return "";
    return `{${entries.map(([key, value]) => `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",")}}`;
  }
}
