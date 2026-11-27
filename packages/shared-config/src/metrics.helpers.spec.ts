import { ServiceName } from '@semcache/shared-types';
import { RpcMetricsRegistry, startMetricsHttpServer } from './metrics.helpers';

describe('RpcMetricsRegistry', () => {
  it('renders Prometheus counters, histograms, and process gauges', () => {
    const registry = new RpcMetricsRegistry(ServiceName.SEMANTIC_CACHE_SERVICE);
    registry.recordRpcRequest('cache.lookup', 'ok', 0.015);
    registry.recordRpcRequest('cache.lookup', 'error', 0.12);

    const output = registry.renderPrometheusMetrics();
    expect(output).toContain('semcache_service_up{service="semantic-cache-service"} 1');
    expect(output).toContain(
      'semcache_rpc_requests_total{service="semantic-cache-service",pattern="cache.lookup",status="ok"} 1',
    );
    expect(output).toContain(
      'semcache_rpc_requests_total{service="semantic-cache-service",pattern="cache.lookup",status="error"} 1',
    );
    expect(output).toContain(
      'semcache_rpc_request_duration_seconds_count{service="semantic-cache-service",pattern="cache.lookup"} 2',
    );
    expect(output).toContain('process_resident_memory_bytes{service="semantic-cache-service"}');
  });

  it('serves /metrics and /health over HTTP and closes cleanly', async () => {
    const registry = new RpcMetricsRegistry(ServiceName.EMBEDDING_SERVICE);
    registry.recordRpcRequest('embeddings.generate', 'ok', 0.04);

    const server = await startMetricsHttpServer({
      service: ServiceName.EMBEDDING_SERVICE,
      host: '127.0.0.1',
      port: 0,
      registry,
    });

    try {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('Expected TCP address');
      }
      const metricsRes = await fetch(`http://127.0.0.1:${addr.port}/metrics`);
      expect(metricsRes.status).toBe(200);
      const text = await metricsRes.text();
      expect(text).toContain('semcache_service_up{service="embedding-service"} 1');

      const healthRes = await fetch(`http://127.0.0.1:${addr.port}/health`);
      expect(healthRes.status).toBe(200);
      const healthJson = (await healthRes.json()) as { service: string; status: string };
      expect(healthJson.service).toBe('embedding-service');
      expect(healthJson.status).toBe('ok');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
