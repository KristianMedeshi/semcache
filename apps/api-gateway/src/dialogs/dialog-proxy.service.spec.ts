import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import { Subject, firstValueFrom, of, throwError, toArray } from 'rxjs';
import {
  createGatewayAuthProxyMock,
  createTestGatewayUser,
  expectSignedInternalHeaders,
  useTestGatewayEnv,
} from '../common/proxy-test-helpers';
import { DialogProxyService } from './dialog-proxy.service';

const TEST_USER = createTestGatewayUser(UserRole.CUSTOMER);

function createDialogProxyHarness(options?: {
  user?: typeof TEST_USER | null;
  dialogSendMock?: jest.Mock;
}) {
  const authProxy = createGatewayAuthProxyMock(
    options?.user === undefined ? TEST_USER : options.user,
  );
  const dialogSendMock = options?.dialogSendMock ?? jest.fn();
  const dialogClient = { send: dialogSendMock } as unknown as ClientProxy;
  const proxy = new DialogProxyService(authProxy, dialogClient);
  return { proxy, dialogSendMock };
}

describe('DialogProxyService', () => {
  useTestGatewayEnv();

  it('rejects unauthenticated callers before calling dialog-service', async () => {
    const { proxy } = createDialogProxyHarness({ user: null });

    await expect(
      proxy.forwardDialogRequest(undefined, SERVICE_TCP_PATTERNS.DIALOGS_LIST),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forwards authenticated requests over TCP with signed internal identity headers', async () => {
    const dialogSendMock = jest.fn(() => of([{ id: 'dialog-1' }]));
    const { proxy } = createDialogProxyHarness({ dialogSendMock });

    const result = await proxy.forwardDialogRequest(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.DIALOGS_LIST,
    );

    expectSignedInternalHeaders(
      dialogSendMock,
      SERVICE_TCP_PATTERNS.DIALOGS_LIST,
      '11111111-1111-4111-8111-111111111111',
    );
    expect(result).toEqual({ data: [{ id: 'dialog-1' }] });
  });

  it('streams events as an Observable and completes open streams on shutdown', async () => {
    const dialogSendMock = jest.fn(() =>
      of({ type: 'delta', delta: 'Hello ' }, { type: 'delta', delta: 'world' }),
    );
    const { proxy } = createDialogProxyHarness({ dialogSendMock });

    const stream$ = await proxy.createDialogStream(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM,
      { dialogId: 'dialog-1', body: { content: 'Hi' } },
    );
    const events = await firstValueFrom(stream$.pipe(toArray()));
    expect(events).toEqual([
      { type: 'delta', delta: 'Hello ' },
      { type: 'delta', delta: 'world' },
    ]);

    const openSubject = new Subject<{ type: 'delta'; delta: string }>();
    const longLivedProxy = createDialogProxyHarness({
      dialogSendMock: jest.fn(() => openSubject.asObservable()),
    }).proxy;
    const liveStream$ = await longLivedProxy.createDialogStream(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM,
      { dialogId: 'dialog-1', body: { content: 'Hi' } },
    );
    let completed = false;
    liveStream$.subscribe({ complete: () => (completed = true) });
    longLivedProxy.beforeApplicationShutdown();
    expect(completed).toBe(true);
  });

  it('maps pre-header TCP stream errors to HttpException', async () => {
    const dialogSendMock = jest.fn(() => throwError(() => new Error('ECONNREFUSED')));
    const { proxy } = createDialogProxyHarness({ dialogSendMock });

    const stream$ = await proxy.createDialogStream(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM,
      { dialogId: 'dialog-1', body: { content: 'Hi' } },
    );

    await expect(firstValueFrom(stream$)).rejects.toThrow(BadGatewayException);
  });

  it('forwards dialogId and messageId in DialogTcpRequestDto when provided', async () => {
    const dialogSendMock = jest.fn(() => of({ ok: true }));
    const { proxy } = createDialogProxyHarness({ dialogSendMock });

    await proxy.forwardDialogRequest(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT,
      {
        dialogId: 'dialog-1',
        messageId: 'msg-1',
        body: { content: 'Edited' },
      },
    );

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
