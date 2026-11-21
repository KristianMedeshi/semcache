import { UnauthorizedException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { INTERNAL_AUTH_HEADERS, SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { GatewayConfigService } from '../config/gateway-config.service';
import { DialogProxyService } from './dialog-proxy.service';

describe('DialogProxyService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = 'test-internal-service-secret-32-chars';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects unauthenticated callers before calling dialog-service', async () => {
    const config = new GatewayConfigService();
    const authClient = { send: jest.fn() } as unknown as ClientProxy;
    const dialogClient = { send: jest.fn() } as unknown as ClientProxy;
    const authProxy = new AuthProxyService(config, authClient);
    jest.spyOn(authProxy, 'resolveCurrentUser').mockResolvedValue(null);

    const proxy = new DialogProxyService(authProxy, dialogClient);
    const req = { method: 'GET', headers: {} } as Request;
    const res = {} as Response;

    await expect(
      proxy.forwardDialogRequest(req, res, SERVICE_TCP_PATTERNS.DIALOGS_LIST),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forwards authenticated requests over TCP with signed internal identity headers', async () => {
    const config = new GatewayConfigService();
    const authClient = { send: jest.fn() } as unknown as ClientProxy;
    const dialogSendMock = jest.fn(() => of([{ id: 'dialog-1' }]));
    const dialogClient = { send: dialogSendMock } as unknown as ClientProxy;
    const authProxy = new AuthProxyService(config, authClient);
    jest.spyOn(authProxy, 'resolveCurrentUser').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@example.com',
      role: UserRole.CUSTOMER,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const proxy = new DialogProxyService(authProxy, dialogClient);
    const req = { method: 'GET', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;

    await proxy.forwardDialogRequest(req, res, SERVICE_TCP_PATTERNS.DIALOGS_LIST);

    expect(dialogSendMock).toHaveBeenCalledTimes(1);
    const [pattern, payload] = dialogSendMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(pattern).toBe(SERVICE_TCP_PATTERNS.DIALOGS_LIST);
    expect(payload.headers[INTERNAL_AUTH_HEADERS.USER_ID]).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(payload.headers[INTERNAL_AUTH_HEADERS.SIGNATURE]).toMatch(/^[a-f0-9]{64}$/);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith([{ id: 'dialog-1' }]);
  });

  it('streams SSE events over HTTP when streamDialogRequest receives TCP stream events', async () => {
    const config = new GatewayConfigService();
    const authClient = { send: jest.fn() } as unknown as ClientProxy;
    const dialogSendMock = jest.fn(() =>
      of({ type: 'delta', delta: 'Hello ' }, { type: 'delta', delta: 'world' }),
    );
    const dialogClient = { send: dialogSendMock } as unknown as ClientProxy;
    const authProxy = new AuthProxyService(config, authClient);
    jest.spyOn(authProxy, 'resolveCurrentUser').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@example.com',
      role: UserRole.CUSTOMER,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const proxy = new DialogProxyService(authProxy, dialogClient);
    const req = { method: 'POST', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const writeHead = jest.fn();
    const write = jest.fn();
    const end = jest.fn();
    const on = jest.fn();
    const res = { writeHead, write, end, on } as unknown as Response;

    await proxy.streamDialogRequest(req, res, SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM, {
      dialogId: 'dialog-1',
      body: { content: 'Hi' },
    });

    expect(writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ 'Content-Type': 'text/event-stream; charset=utf-8' }),
    );
    expect(write).toHaveBeenNthCalledWith(1, 'data: {"type":"delta","delta":"Hello "}\n\n');
    expect(write).toHaveBeenNthCalledWith(2, 'data: {"type":"delta","delta":"world"}\n\n');
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('emits an SSE error event if TCP stream fails after headers are sent', async () => {
    const config = new GatewayConfigService();
    const authClient = { send: jest.fn() } as unknown as ClientProxy;
    const dialogSendMock = jest.fn(
      () =>
        new Observable((subscriber) => {
          subscriber.next({ type: 'delta', delta: 'Partial' });
          subscriber.error({ statusCode: 502, message: 'Provider failed mid-stream' });
        }),
    );
    const dialogClient = { send: dialogSendMock } as unknown as ClientProxy;
    const authProxy = new AuthProxyService(config, authClient);
    jest.spyOn(authProxy, 'resolveCurrentUser').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@example.com',
      role: UserRole.CUSTOMER,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const proxy = new DialogProxyService(authProxy, dialogClient);
    const req = { method: 'POST', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const writeHead = jest.fn();
    const write = jest.fn();
    const end = jest.fn();
    const on = jest.fn();
    const res = { writeHead, write, end, on } as unknown as Response;

    await proxy.streamDialogRequest(req, res, SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM, {
      dialogId: 'dialog-1',
      body: { content: 'Hi' },
    });

    expect(write).toHaveBeenNthCalledWith(1, 'data: {"type":"delta","delta":"Partial"}\n\n');
    expect(write).toHaveBeenNthCalledWith(
      2,
      'data: {"type":"error","statusCode":502,"message":"Provider failed mid-stream"}\n\n',
    );
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('forwards dialogId and messageId in DialogTcpRequestDto when provided', async () => {
    const config = new GatewayConfigService();
    const authClient = { send: jest.fn() } as unknown as ClientProxy;
    const dialogSendMock = jest.fn(() => of({ ok: true }));
    const dialogClient = { send: dialogSendMock } as unknown as ClientProxy;
    const authProxy = new AuthProxyService(config, authClient);
    jest.spyOn(authProxy, 'resolveCurrentUser').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'alice@example.com',
      role: UserRole.CUSTOMER,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const proxy = new DialogProxyService(authProxy, dialogClient);
    const req = { method: 'POST', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;

    await proxy.forwardDialogRequest(req, res, SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT, {
      dialogId: 'dialog-1',
      messageId: 'msg-1',
      body: { content: 'Edited' },
    });

    expect(dialogSendMock).toHaveBeenCalledWith(
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT,
      expect.objectContaining({
        dialogId: 'dialog-1',
        messageId: 'msg-1',
        body: { content: 'Edited' },
      }),
    );
  });
});
