type Quantiles = {
  p50_ms: number | null;
  p95_ms: number | null;
};

/**
 * Lightweight in-process latency metrics.
 *
 * Trade-off: avoids external monitoring dependencies, but quantiles are approximate.
 * We bucket durations and compute p50/p95 as the upper bound of the bucket that crosses the threshold.
 */
export class LatencyHistogram {
  private readonly bucketsMs: number[];
  private readonly counts: number[];
  private total = 0;

  constructor(bucketsMs: number[]) {
    // Buckets are upper bounds in ms, last bucket should represent "infinity".
    this.bucketsMs = [...bucketsMs].sort((a, b) => a - b);
    this.counts = new Array(this.bucketsMs.length).fill(0);
  }

  record(durationMs: number) {
    const d = Math.max(0, Math.floor(durationMs));
    const idx = this.bucketsMs.findIndex((b) => d <= b);
    const bucketIndex = idx === -1 ? this.counts.length - 1 : idx;
    this.counts[bucketIndex] += 1;
    this.total += 1;
  }

  quantiles(): Quantiles {
    if (this.total === 0) return { p50_ms: null, p95_ms: null };
    return {
      p50_ms: this.quantileUpperBound(0.5),
      p95_ms: this.quantileUpperBound(0.95)
    };
  }

  private quantileUpperBound(q: number): number {
    const target = Math.ceil(this.total * q);
    let cumulative = 0;
    for (let i = 0; i < this.counts.length; i += 1) {
      cumulative += this.counts[i]!;
      if (cumulative >= target) return this.bucketsMs[i]!;
    }
    return this.bucketsMs[this.bucketsMs.length - 1]!;
  }
}

// Default histogram for the carrier callback path. Tuned around our 1200ms hard timeout.
export const carrierLatency = new LatencyHistogram([
  10, 25, 50, 75, 100, 150, 200, 300, 400, 600, 800, 1000, 1200, 1500, 2000, 5000
]);

