const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

describe('SemCache Live System E2E (API Gateway)', () => {
  it('exposes /health, /metrics, and /docs-json when API Gateway is running', async () => {
    const healthRes = await fetch(`${API_BASE_URL}/health`);
    expect(healthRes.status).toBe(200);
    const healthBody = (await healthRes.json()) as { service: string; status: string };
    expect(healthBody.service).toBe('api-gateway');
    expect(healthBody.status).toBe('ok');

    const metricsRes = await fetch(`${API_BASE_URL}/metrics`);
    expect(metricsRes.status).toBe(200);
    const metricsText = await metricsRes.text();
    expect(metricsText).toContain('semcache_http_requests_total');
    expect(metricsText).toContain('process_resident_memory_bytes');

    const docsRes = await fetch(`${API_BASE_URL}/docs-json`);
    expect(docsRes.status).toBe(200);
    const docsJson = (await docsRes.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(docsJson.openapi).toMatch(/^3\./);
    expect(docsJson.paths['/dialogs']).toBeDefined();
    expect(docsJson.paths['/admin/semantic-cache/settings']).toBeDefined();
  });
});
