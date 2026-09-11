import { cpuThrottleFromStat, parseKeyValueStat, percentile, PhaseTimer } from "./perf-diagnostics";

describe("perf diagnostics helpers", () => {
  it("computes nearest-rank percentiles", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(100);
    expect(percentile(values, 10)).toBe(10);
    expect(percentile([], 95)).toBe(0);
  });

  it("parses cgroup v2 cpu.stat", () => {
    const raw = "usage_usec 1200\nuser_usec 800\nsystem_usec 400\nnr_periods 50\nnr_throttled 7\nthrottled_usec 350000\n";
    expect(parseKeyValueStat(raw).usage_usec).toBe(1200);
    expect(cpuThrottleFromStat(raw)).toEqual({ throttledUsec: 350000, nrThrottled: 7 });
  });

  it("parses cgroup v1 cpu.stat (throttled_time in ns)", () => {
    const raw = "nr_periods 50\nnr_throttled 3\nthrottled_time 2500000000\n";
    expect(cpuThrottleFromStat(raw)).toEqual({ throttledUsec: 2500000, nrThrottled: 3 });
  });

  it("returns null when there are no throttling fields", () => {
    expect(cpuThrottleFromStat("usage_usec 10\n")).toBeNull();
  });

  it("formats phase laps with a total", () => {
    const timer = new PhaseTimer();
    timer.lap("a");
    timer.lap("b");
    expect(timer.format()).toMatch(/^a=\d+ms b=\d+ms total=\d+ms$/);
  });
});
