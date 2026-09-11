import { Logger } from "@nestjs/common";
import { readFileSync } from "fs";
import { IntervalHistogram, monitorEventLoopDelay, performance } from "perf_hooks";

/**
 * Opt-in performance diagnostics, used to find out where checkout latency goes under load.
 *
 * Everything here is a no-op unless PERF_DIAGNOSTICS=true, so it can be switched on and off
 * from the host's environment variables without a code change. When enabled it emits:
 *  - one "perf.window" line every 5s while there is DB activity: Prisma query durations
 *    (count/avg/p50/p95/max), event-loop delay, process CPU time and cgroup CPU throttling;
 *  - per-checkout phase timings (logged by the checkout code via PhaseTimer).
 */
export function isPerfDiagnosticsEnabled(): boolean {
  return process.env.PERF_DIAGNOSTICS === "true";
}

export function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const index = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[index];
}

export function parseKeyValueStat(raw: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of raw.split("\n")) {
    const [key, value] = line.trim().split(/\s+/);
    if (key && value !== undefined && /^\d+$/.test(value)) {
      result[key] = Number(value);
    }
  }
  return result;
}

export type CpuThrottleStat = { throttledUsec: number; nrThrottled: number };

/** Parses cgroup v2 ("throttled_usec") or v1 ("throttled_time", in ns) cpu.stat contents. */
export function cpuThrottleFromStat(raw: string): CpuThrottleStat | null {
  const stat = parseKeyValueStat(raw);
  if (stat.throttled_usec !== undefined) {
    return { throttledUsec: stat.throttled_usec, nrThrottled: stat.nr_throttled ?? 0 };
  }
  if (stat.throttled_time !== undefined) {
    return { throttledUsec: Math.round(stat.throttled_time / 1000), nrThrottled: stat.nr_throttled ?? 0 };
  }
  return null;
}

const CGROUP_CPU_STAT_PATHS = [
  "/sys/fs/cgroup/cpu.stat",
  "/sys/fs/cgroup/cpu/cpu.stat",
  "/sys/fs/cgroup/cpu,cpuacct/cpu.stat"
];

function readCgroupThrottle(): CpuThrottleStat | null {
  for (const path of CGROUP_CPU_STAT_PATHS) {
    try {
      const parsed = cpuThrottleFromStat(readFileSync(path, "utf8"));
      if (parsed) return parsed;
    } catch {
      // Path not present in this cgroup layout; try the next one.
    }
  }
  return null;
}

/** Records elapsed milliseconds between successive laps, for one request. */
export class PhaseTimer {
  private readonly startedAt = performance.now();
  private lastAt = this.startedAt;
  private readonly phases: Array<[string, number]> = [];

  lap(name: string) {
    const now = performance.now();
    this.phases.push([name, now - this.lastAt]);
    this.lastAt = now;
  }

  format() {
    const parts = this.phases.map(([name, ms]) => `${name}=${Math.round(ms)}ms`);
    parts.push(`total=${Math.round(performance.now() - this.startedAt)}ms`);
    return parts.join(" ");
  }
}

const WINDOW_MS = 5000;
const MAX_SAMPLES_PER_WINDOW = 50_000;

class PerfCollector {
  private readonly logger = new Logger("PerfDiagnostics");
  private queryDurations: number[] = [];
  private histogram?: IntervalHistogram;
  private timer?: NodeJS.Timeout;
  private lastThrottle: CpuThrottleStat | null = null;
  private lastCpuUsage = process.cpuUsage();

  start() {
    if (this.timer) return;
    this.histogram = monitorEventLoopDelay({ resolution: 10 });
    this.histogram.enable();
    this.lastThrottle = readCgroupThrottle();
    this.lastCpuUsage = process.cpuUsage();
    this.timer = setInterval(() => this.flush(), WINDOW_MS);
    this.timer.unref();
    this.logger.log(`Perf diagnostics enabled (window=${WINDOW_MS}ms, cgroupThrottleStats=${this.lastThrottle ? "yes" : "no"})`);
  }

  recordQuery(durationMs: number) {
    if (this.queryDurations.length < MAX_SAMPLES_PER_WINDOW) {
      this.queryDurations.push(durationMs);
    }
  }

  private flush() {
    const durations = this.queryDurations.sort((a, b) => a - b);
    this.queryDurations = [];

    const cpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();
    const processCpuMs = Math.round((cpuUsage.user + cpuUsage.system) / 1000);

    const throttle = readCgroupThrottle();
    const throttledMs = throttle && this.lastThrottle ? Math.round((throttle.throttledUsec - this.lastThrottle.throttledUsec) / 1000) : null;
    const nrThrottled = throttle && this.lastThrottle ? throttle.nrThrottled - this.lastThrottle.nrThrottled : null;
    this.lastThrottle = throttle;

    const loopP99Ms = this.histogram ? Math.round(this.histogram.percentile(99) / 1e6) : 0;
    const loopMaxMs = this.histogram ? Math.round(this.histogram.max / 1e6) : 0;
    this.histogram?.reset();

    // Stay quiet while idle (health checks don't touch the DB).
    if (!durations.length && !throttledMs && loopMaxMs < 100) return;

    const avg = durations.length ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0;
    this.logger.log(
      `perf.window ${WINDOW_MS / 1000}s db.queries=${durations.length} db.avg=${avg}ms db.p50=${percentile(durations, 50)}ms ` +
      `db.p95=${percentile(durations, 95)}ms db.max=${durations[durations.length - 1] ?? 0}ms ` +
      `eventLoop.p99=${loopP99Ms}ms eventLoop.max=${loopMaxMs}ms process.cpu=${processCpuMs}ms ` +
      `cgroup.throttled=${throttledMs ?? "n/a"}ms cgroup.nrThrottled=${nrThrottled ?? "n/a"}`
    );
  }
}

export const perfCollector = new PerfCollector();
