import { UnauthorizedException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { createValidatedConfigService } from '@semcache/shared-config';
import { INTERNAL_AUTH_HEADERS, SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { gatewayEnvSchema } from '../config/gateway.env';
import { DialogProxyService } from './dialog-proxy.service';

const TEST_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@example.com',
  role: UserRole.CUSTOMER,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createDialogProxyHarness(options?: {
  user?: typeof TEST_USER | null;
  dialogSendMock?: jest.Mock;
}) {
  const config = createValidatedConfigService(gatewayEnvSchema, { loadEnvFiles: false });
  const authClient = { send: jest.fn() } as unknown as ClientProxy;
  const dialogSendMock = options?.dialogSendMock ?? jest.fn();
  const dialogClient = { send: dialogSendMock } as unknown as ClientProxy;
  const authProxy = new AuthProxyService(config, authClient);
  jest
    .spyOn(authProxy, 'resolveCurrentUser')
    .mockResolvedValue(options?.user === undefined ? TEST_USER : options.user);

  const proxy = new DialogProxyService(authProxy, dialogClient);
  return { proxy, dialogSendMock };
}

function createJsonResponseMock() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
}

function createStreamResponseMock() {
  const writeHead = jest.fn();
  const write = jest.fn();
  const end = jest.fn();
  const on = jest.fn();
  return { res: { writeHead, write, end, on } as unknown as Response, writeHead, write, end };
}

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
    const { proxy } = createDialogProxyHarness({ user: null });
    const req = { method: 'GET', headers: {} } as Request;
    const res = {} as Response;

    await expect(
      proxy.forwardDialogRequest(req, res, SERVICE_TCP_PATTERNS.DIALOGS_LIST),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forwards authenticated requests over TCP with signed internal identity headers', async () => {
    const dialogSendMock = jest.fn(() => of([{ id: 'dialog-1' }]));
    const { proxy } = createDialogProxyHarness({ dialogSendMock });
    const req = { method: 'GET', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const { res, status, json } = createJsonResponseMock();

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
    const dialogSendMock = jest.fn(() =>
      of({ type: 'delta', delta: 'Hello ' }, { type: 'delta', delta: 'world' }),
    );
    const { proxy } = createDialogProxyHarness({ dialogSendMock });
    const req = { method: 'POST', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const { res, writeHead, write, end } = createStreamResponseMock();

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
    const dialogSendMock = jest.fn(
      () =>
        new Observable((subscriber) => {
          subscriber.next({ type: 'delta', delta: 'Partial' });
          subscriber.error({ statusCode: 502, message: 'Provider failed mid-stream' });
        }),
    );
    const { proxy } = createDialogProxyHarness({ dialogSendMock });
    const req = { method: 'POST', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const { res, write, end } = createStreamResponseMock();

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
    const dialogSendMock = jest.fn(() => of({ ok: true }));
    const { proxy } = createDialogProxyHarness({ dialogSendMock });
    const req = { method: 'POST', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const { res } = createJsonResponseMock();

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
