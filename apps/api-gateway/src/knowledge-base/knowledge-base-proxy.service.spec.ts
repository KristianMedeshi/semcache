import { UnauthorizedException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { INTERNAL_AUTH_HEADERS, SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { of } from 'rxjs';
import {
  createGatewayAuthProxyMock,
  createJsonResponseMock,
  createTestGatewayUser,
  useTestGatewayEnv,
} from '../common/proxy-test-helpers';
import { KnowledgeBaseProxyService } from './knowledge-base-proxy.service';

const TEST_ADMIN = createTestGatewayUser(UserRole.ADMIN);

function createKbProxyHarness(options?: {
  user?: typeof TEST_ADMIN | null;
  kbSendMock?: jest.Mock;
}) {
  const authProxy = createGatewayAuthProxyMock(
    options?.user === undefined ? TEST_ADMIN : options.user,
  );
  const kbSendMock = options?.kbSendMock ?? jest.fn();
  const kbClient = { send: kbSendMock } as unknown as ClientProxy;
  const proxy = new KnowledgeBaseProxyService(authProxy, kbClient);
  return { proxy, kbSendMock };
}

describe('KnowledgeBaseProxyService', () => {
  useTestGatewayEnv();

  it('rejects unauthenticated requests before forwarding to knowledge-base-service', async () => {
    const { proxy } = createKbProxyHarness({ user: null });
    const req = { method: 'GET', headers: {} } as Request;
    const res = {} as Response;

    await expect(
      proxy.forwardKnowledgeBaseRequest(req, res, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forwards authenticated requests with signed internal identity headers', async () => {
    const kbSendMock = jest.fn(() => of([{ id: 'doc-1', title: 'FAQ' }]));
    const { proxy } = createKbProxyHarness({ kbSendMock });
    const req = { method: 'GET', headers: { cookie: 'semcache_sid=abc' } } as Request;
    const { res, status, json } = createJsonResponseMock();

    await proxy.forwardKnowledgeBaseRequest(req, res, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST);

    expect(kbSendMock).toHaveBeenCalledTimes(1);
    const [pattern, payload] = kbSendMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(pattern).toBe(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST);
    expect(payload.headers[INTERNAL_AUTH_HEADERS.USER_ID]).toBe(TEST_ADMIN.id);
    expect(payload.headers[INTERNAL_AUTH_HEADERS.SIGNATURE]).toMatch(/^[a-f0-9]{64}$/);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith([{ id: 'doc-1', title: 'FAQ' }]);
  });
});
