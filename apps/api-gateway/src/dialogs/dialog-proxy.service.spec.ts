import { UnauthorizedException } from '@nestjs/common';
import { INTERNAL_AUTH_HEADERS, UserRole } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { GatewayConfigService } from '../config/gateway-config.service';
import { DialogProxyService } from './dialog-proxy.service';

describe('DialogProxyService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = 'test-internal-service-secret-32-chars';
    process.env.DIALOG_SERVICE_URL = 'http://127.0.0.1:3002';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('rejects unauthenticated callers before calling dialog-service', async () => {
    const config = new GatewayConfigService();
    const authProxy = new AuthProxyService(config);
    jest.spyOn(authProxy, 'resolveCurrentUser').mockResolvedValue(null);

    const proxy = new DialogProxyService(config, authProxy);
    const req = { method: 'GET', headers: {} } as Request;
    const res = {} as Response;

    await expect(proxy.forwardDialogRequest(req, res, '/dialogs')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('forwards authenticated requests with signed internal identity headers', async () => {
    const config = new GatewayConfigService();
    const authProxy = new AuthProxyService(config);
    jest.spyOn(authProxy, 'resolveCurrentUser').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@example.com',
      role: UserRole.CUSTOMER,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const fetchMock = jest.fn(
      async () =>
        new Response(JSON.stringify([{ id: 'dialog-1' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    global.fetch = fetchMock as typeof fetch;

    const proxy = new DialogProxyService(config, authProxy);
    const req = { method: 'GET', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;

    await proxy.forwardDialogRequest(req, res, '/dialogs');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers[INTERNAL_AUTH_HEADERS.USER_ID]).toBe('11111111-1111-4111-8111-111111111111');
    expect(headers[INTERNAL_AUTH_HEADERS.SIGNATURE]).toMatch(/^[a-f0-9]{64}$/);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith([{ id: 'dialog-1' }]);
  });
});
