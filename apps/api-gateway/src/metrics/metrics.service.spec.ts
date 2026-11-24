import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('renders Prometheus counters, histograms, and process gauges', () => {
    const metrics = new MetricsService();
    metrics.recordHttpRequest('POST', '/dialogs/:id/messages', 200, 0.125);
    metrics.recordCacheTurn({
      status: 'HIT',
      mode: 'adaptive',
      category: 'billing',
      durationSeconds: 0.02,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });
    metrics.recordCacheTurn({
      status: 'MISS',
      mode: 'adaptive',
      category: 'billing',
      durationSeconds: 0.85,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
    metrics.recordKbInvalidation('sources');

    const output = metrics.renderPrometheusMetrics();
    expect(output).toContain(
      'semcache_http_requests_total{method="POST",route="/dialogs/:id/messages",status_code="200"} 1',
    );
    expect(output).toContain(
      'semcache_cache_lookups_total{status="HIT",mode="adaptive",category="billing"} 1',
    );
    expect(output).toContain('semcache_llm_tokens_total{type="total"} 150');
    expect(output).toContain('semcache_kb_invalidations_total{scope="sources"} 1');
    expect(output).toContain('process_resident_memory_bytes ');
  });
});
