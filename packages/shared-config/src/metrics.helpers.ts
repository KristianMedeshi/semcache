import { createServer, type Server } from 'node:http';
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  Optional,
} from '@nestjs/common';
import type { ServiceName } from '@semcache/shared-types';
import { type Observable, tap } from 'rxjs';

const RPC_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15, 30];
const SERVICE_NAME_TOKEN = Symbol('SEMCACHE_METRICS_SERVICE_NAME');

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

function extractRpcPatternName(handler: unknown): string {
  if (typeof handler !== 'function') {
    return 'unknown';
  }
  const metadata: unknown = Reflect.getMetadata('microservices:pattern', handler);
  if (typeof metadata === 'string') {
    return metadata;
  }
  if (Array.isArray(metadata) && metadata.length > 0) {
    return String(metadata[0]);
  }
  if (metadata !== undefined && metadata !== null) {
    return JSON.stringify(metadata);
  }
  return 'unknown';
}

/**
 * Lightweight Prometheus metrics registry for internal NestJS TCP microservices.
 */
export class RpcMetricsRegistry {
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

  constructor(public readonly service: ServiceName | string) {
    this.counters.set('semcache_rpc_requests_total', {
      help: 'Total TCP RPC requests handled by internal microservices',
      series: new Map(),
    });
    this.histograms.set('semcache_rpc_request_duration_seconds', {
      help: 'TCP RPC request duration in seconds',
      buckets: RPC_DURATION_BUCKETS,
      series: new Map(),
    });
  }

  recordRpcRequest(pattern: string, status: 'ok' | 'error', durationSeconds: number): void {
    const service = String(this.service);
    this.incCounter('semcache_rpc_requests_total', { service, pattern, status }, 1);
    this.observeHistogram(
      'semcache_rpc_request_duration_seconds',
      { service, pattern },
      durationSeconds,
    );
  }

  renderPrometheusMetrics(): string {
    const lines: string[] = [];
    const service = String(this.service);

    lines.push('# HELP semcache_service_up Whether the SemCache microservice is running.');
    lines.push('# TYPE semcache_service_up gauge');
    lines.push(`semcache_service_up${formatLabels({ service })} 1`);

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
    lines.push(`process_resident_memory_bytes${formatLabels({ service })} ${mem.rss}`);
    lines.push('# HELP process_uptime_seconds Process uptime in seconds.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds${formatLabels({ service })} ${process.uptime().toFixed(3)}`);

    return `${lines.join('\n')}\n`;
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

const serviceRegistries = new Map<string, RpcMetricsRegistry>();

/**
 * Returns the singleton `RpcMetricsRegistry` for the given microservice.
 */
export function getOrCreateServiceMetricsRegistry(service: ServiceName | string): RpcMetricsRegistry {
  const key = String(service);
  let registry = serviceRegistries.get(key);
  if (!registry) {
    registry = new RpcMetricsRegistry(service);
    serviceRegistries.set(key, registry);
  }
  return registry;
}

/**
 * Global NestJS interceptor recording RPC call counts and latency histograms per pattern.
 */
@Injectable()
export class RpcMetricsInterceptor implements NestInterceptor {
  private readonly registry: RpcMetricsRegistry;

  constructor(@Optional() @Inject(SERVICE_NAME_TOKEN) service: string = 'unknown') {
    this.registry = getOrCreateServiceMetricsRegistry(service);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const pattern = extractRpcPatternName(context.getHandler());
    const startedAt = performance.now();
    let recorded = false;

    const record = (status: 'ok' | 'error') => {
      if (recorded) return;
      recorded = true;
      this.registry.recordRpcRequest(pattern, status, (performance.now() - startedAt) / 1000);
    };

    return next.handle().pipe(
      tap({
        next: () => record('ok'),
        complete: () => record('ok'),
        error: () => record('error'),
      }),
    );
  }
}

export { SERVICE_NAME_TOKEN };

/**
 * Starts a lightweight HTTP server exposing `/metrics` (Prometheus text exposition) and `/health`
 * for internal TCP microservices.
 */
export function startMetricsHttpServer(options: {
  service: ServiceName | string;
  host: string;
  port: number;
  registry?: RpcMetricsRegistry;
}): Promise<Server> {
  const registry = options.registry ?? getOrCreateServiceMetricsRegistry(options.service);
  const server = createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0];
    if (req.method === 'GET' && urlPath === '/metrics') {
      const body = registry.renderPrometheusMetrics();
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.end(body);
      return;
    }
    if (req.method === 'GET' && urlPath === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          service: options.service,
          status: 'ok',
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ statusCode: 404, message: 'Not Found' }));
  });

  return new Promise<Server>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}
