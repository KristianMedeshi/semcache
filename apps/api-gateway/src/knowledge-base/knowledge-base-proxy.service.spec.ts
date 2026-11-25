import { UnauthorizedException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { KnowledgeDocumentStatus, SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import { of } from 'rxjs';
import {
  createGatewayAuthProxyMock,
  createTestGatewayUser,
  expectSignedInternalHeaders,
  useTestGatewayEnv,
} from '../common/proxy-test-helpers';
import type { MetricsService } from '../metrics/metrics.service';
import { KnowledgeBaseProxyService } from './knowledge-base-proxy.service';

const TEST_ADMIN = createTestGatewayUser(UserRole.ADMIN);

function createKbProxyHarness(options?: {
  user?: typeof TEST_ADMIN | null;
  kbSendMock?: jest.Mock;
  recordKbInvalidation?: jest.Mock;
}) {
  const authProxy = createGatewayAuthProxyMock(
    options?.user === undefined ? TEST_ADMIN : options.user,
  );
  const kbSendMock = options?.kbSendMock ?? jest.fn();
  const kbClient = { send: kbSendMock } as unknown as ClientProxy;
  const metricsService = options?.recordKbInvalidation
    ? ({ recordKbInvalidation: options.recordKbInvalidation } as unknown as MetricsService)
    : undefined;
  const proxy = new KnowledgeBaseProxyService(authProxy, kbClient, undefined, metricsService);
  return { proxy, kbSendMock };
}

describe('KnowledgeBaseProxyService', () => {
  useTestGatewayEnv();

  it('rejects unauthenticated requests before forwarding to knowledge-base-service', async () => {
    const { proxy } = createKbProxyHarness({ user: null });

    await expect(
      proxy.forwardKnowledgeBaseRequest(undefined, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forwards authenticated requests with signed internal identity headers', async () => {
    const kbSendMock = jest.fn(() => of([{ id: 'doc-1', title: 'FAQ' }]));
    const { proxy } = createKbProxyHarness({ kbSendMock });

    const result = await proxy.forwardKnowledgeBaseRequest(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST,
    );

    expectSignedInternalHeaders(kbSendMock, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST, TEST_ADMIN.id);
    expect(result).toEqual([{ id: 'doc-1', title: 'FAQ' }]);
  });

  it('records KB invalidation metrics for ready uploads, reprocess, and deletes', async () => {
    const recordKbInvalidation = jest.fn();
    const kbSendMock = jest
      .fn()
      .mockReturnValueOnce(of({ id: 'doc-1', status: KnowledgeDocumentStatus.READY }))
      .mockReturnValueOnce(of({ id: 'doc-2', status: KnowledgeDocumentStatus.FAILED }))
      .mockReturnValueOnce(of({ id: 'doc-1', status: KnowledgeDocumentStatus.READY }))
      .mockReturnValueOnce(of({ id: 'doc-1', deleted: true, deletedChunksCount: 1 }));
    const { proxy } = createKbProxyHarness({ kbSendMock, recordKbInvalidation });

    await proxy.forwardKnowledgeBaseRequest(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_UPLOAD,
    );
    await proxy.forwardKnowledgeBaseRequest(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_UPLOAD,
    );
    await proxy.forwardKnowledgeBaseRequest(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_REPROCESS,
      { documentId: 'doc-1' },
    );
    await proxy.forwardKnowledgeBaseRequest(
      'semcache_sid=abc',
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_DELETE,
      { documentId: 'doc-1' },
    );

    expect(recordKbInvalidation.mock.calls).toEqual([
      ['unlinked'],
      ['sources'],
      ['unlinked'],
      ['sources'],
    ]);
  });
});
