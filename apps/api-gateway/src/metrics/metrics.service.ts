import { Injectable } from '@nestjs/common';

const HTTP_DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15, 30, 60];
const CACHE_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15, 30];

interface HistogramState {
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return `{${entries.map(([k, v]) => `${k}="${escapeLabelValue(v)}"`).join(',')}}`;
}

function labelsKey(labels: Record<string, string>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\0');
}

@Injectable()
export class MetricsService {
  private readonly counters = new Map<
    string,
    { help: string; series: Map<string, { labels: Record<string, string>; value: number }> }
  >();
  private readonly histograms = new Map<
    string,
    {
      help: string;
      buckets: number[];
      series: Map<string, { labels: Record<string, string>; state: HistogramState }>;
    }
  >();

  constructor() {
    this.registerCounter(
      'semcache_http_requests_total',
      'Total HTTP requests handled by api-gateway',
    );
    this.registerHistogram(
      'semcache_http_request_duration_seconds',
      'HTTP request duration in seconds',
      HTTP_DURATION_BUCKETS,
    );
    this.registerCounter('semcache_cache_lookups_total', 'Total semantic cache lookup outcomes');
    this.registerHistogram(
      'semcache_cache_lookup_duration_seconds',
      'Dialog turn duration split by cache status',
      CACHE_DURATION_BUCKETS,
    );
    this.registerCounter('semcache_llm_tokens_total', 'LLM tokens consumed by type');
    this.registerCounter('semcache_kb_invalidations_total', 'Knowledge base cache invalidations');
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: String(statusCode),
    };
    this.incCounter('semcache_http_requests_total', labels, 1);
    this.observeHistogram('semcache_http_request_duration_seconds', { route }, durationSeconds);
  }

  recordCacheTurn(input: {
    status: string;
    mode: string;
    category: string;
    durationSeconds: number;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  }): void {
    this.incCounter(
      'semcache_cache_lookups_total',
      {
        status: input.status,
        mode: input.mode,
        category: input.category,
      },
      1,
    );
    this.observeHistogram(
      'semcache_cache_lookup_duration_seconds',
      { status: input.status },
      input.durationSeconds,
    );

    if (input.usage) {
      if (typeof input.usage.promptTokens === 'number' && input.usage.promptTokens > 0) {
        this.incCounter('semcache_llm_tokens_total', { type: 'prompt' }, input.usage.promptTokens);
      }
      if (typeof input.usage.completionTokens === 'number' && input.usage.completionTokens > 0) {
        this.incCounter(
          'semcache_llm_tokens_total',
          { type: 'completion' },
          input.usage.completionTokens,
        );
      }
      if (typeof input.usage.totalTokens === 'number' && input.usage.totalTokens > 0) {
        this.incCounter('semcache_llm_tokens_total', { type: 'total' }, input.usage.totalTokens);
      }
    }
  }

  recordKbInvalidation(scope: string): void {
    this.incCounter('semcache_kb_invalidations_total', { scope }, 1);
  }

  renderPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const [name, metric] of this.counters.entries()) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} counter`);
      for (const entry of metric.series.values()) {
        lines.push(`${name}${formatLabels(entry.labels)} ${entry.value}`);
      }
    }

    for (const [name, metric] of this.histograms.entries()) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} histogram`);
      for (const entry of metric.series.values()) {
        const { buckets, counts, sum, count } = entry.state;
        for (let i = 0; i < buckets.length; i += 1) {
          lines.push(
            `${name}_bucket${formatLabels({ ...entry.labels, le: String(buckets[i]) })} ${counts[i]}`,
          );
        }
        lines.push(`${name}_bucket${formatLabels({ ...entry.labels, le: '+Inf' })} ${count}`);
        lines.push(`${name}_sum${formatLabels(entry.labels)} ${sum}`);
        lines.push(`${name}_count${formatLabels(entry.labels)} ${count}`);
      }
    }

    const mem = process.memoryUsage();
    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${mem.rss}`);
    lines.push('# HELP process_uptime_seconds Process uptime in seconds.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${process.uptime().toFixed(3)}`);

    return `${lines.join('\n')}\n`;
  }

  private registerCounter(name: string, help: string): void {
    this.counters.set(name, { help, series: new Map() });
  }

  private registerHistogram(name: string, help: string, buckets: number[]): void {
    this.histograms.set(name, { help, buckets, series: new Map() });
  }

  private incCounter(name: string, labels: Record<string, string>, delta: number): void {
    const metric = this.counters.get(name);
    if (!metric) return;
    const key = labelsKey(labels);
    const existing = metric.series.get(key);
    if (existing) {
      existing.value += delta;
    } else {
      metric.series.set(key, { labels, value: delta });
    }
  }

  private observeHistogram(name: string, labels: Record<string, string>, value: number): void {
    const metric = this.histograms.get(name);
    if (!metric) return;
    const key = labelsKey(labels);
    let entry = metric.series.get(key);
    if (!entry) {
      entry = {
        labels,
        state: {
          buckets: metric.buckets,
          counts: metric.buckets.map(() => 0),
          sum: 0,
          count: 0,
        },
      };
      metric.series.set(key, entry);
    }
    const { state } = entry;
    state.sum += value;
    state.count += 1;
    for (let i = 0; i < state.buckets.length; i += 1) {
      if (value <= (state.buckets[i] as number)) {
        state.counts[i] = (state.counts[i] as number) + 1;
      }
    }
  }
}
