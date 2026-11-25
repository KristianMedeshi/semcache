import type { RetrieveKnowledgeContextResponseDto } from '@semcache/shared-dtos';
import {
  CacheHitStatus,
  CacheMode,
  QueryCategory,
  SERVICE_TCP_PATTERNS,
} from '@semcache/shared-types';
import { of, throwError } from 'rxjs';
import {
  createInMemoryDialogHarness,
  createMockEmbeddingResponse,
  extractSentSystemPrompt,
} from '../../test/dialog-test-helpers';

describe('DialogGraphService (RAG & Semantic Cache orchestration)', () => {
  it('retrieves knowledge base context and injects grounding rules into the LLM system prompt', async () => {
    const kbResponse: RetrieveKnowledgeContextResponseDto = {
      query: 'How much EU roaming data is included?',
      hasRelevantContext: true,
      formattedContext:
        '[Source 1: Roaming Guide (roaming.md) | Category: product_inquiry | Section Chunk #1]\n5G Unlimited includes 25 GB EU roaming per month.',
      results: [],
      sources: [
        {
          documentId: 'doc-1',
          documentTitle: 'Roaming Guide',
          fileName: 'roaming.md',
          category: QueryCategory.PRODUCT_INQUIRY,
          chunkId: 'chunk-1',
          chunkIndex: 0,
        },
      ],
    };

    const { userId, dialogId, service, sendMock, kbSendMock } = createInMemoryDialogHarness({
      sendImpl: jest.fn(() =>
        of({
          content: 'Your 5G Unlimited plan includes 25 GB of EU roaming per month.',
          model: 'openrouter/free',
          latencyMs: 80,
          usage: { promptTokens: 40, completionTokens: 14, totalTokens: 54 },
        }),
      ),
      kbSendImpl: jest.fn(() => of(kbResponse)),
    });

    await service.sendMessage(userId, dialogId, {
      content: 'How much EU roaming data is included?',
    });

    expect(kbSendMock).toHaveBeenCalledWith(SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE, {
      body: {
        query: 'How much EU roaming data is included?',
        topK: 4,
        minSimilarity: 0.25,
      },
    });

    const systemPrompt = extractSentSystemPrompt(sendMock);
    expect(systemPrompt).toContain('Prioritize the retrieved Knowledge Base context');
    expect(systemPrompt).toContain(
      'Never invent, guess, or fabricate company-specific information',
    );
    expect(systemPrompt).toContain('5G Unlimited includes 25 GB EU roaming per month.');
  });

  it('falls back gracefully when knowledge-base-service is unavailable and instructs LLM not to invent details', async () => {
    const { userId, dialogId, service, sendMock } = createInMemoryDialogHarness({
      sendImpl: jest.fn(() =>
        of({
          content: 'I do not have verified information on that.',
          model: 'openrouter/free',
          latencyMs: 65,
          usage: { promptTokens: 30, completionTokens: 9, totalTokens: 39 },
        }),
      ),
      kbSendImpl: jest.fn(() => throwError(() => new Error('KB offline'))),
    });

    const turn = await service.sendMessage(userId, dialogId, {
      content: 'What is the secret VIP tariff?',
    });

    expect(turn.assistantMessage.content).toBe('I do not have verified information on that.');
    expect(extractSentSystemPrompt(sendMock)).toContain('No relevant company documents were found');
  });

  it('short-circuits KB and LLM on semantic cache HIT with zero tokens', async () => {
    const sendMock = jest.fn((pattern: string) => {
      if (pattern === SERVICE_TCP_PATTERNS.LLM_EMBEDDINGS) {
        return createMockEmbeddingResponse();
      }
      throw new Error(`Unexpected LLM call: ${pattern}`);
    });
    const kbSendMock = jest.fn();
    const cacheSendMock = jest.fn((pattern: string) => {
      if (pattern === SERVICE_TCP_PATTERNS.CACHE_LOOKUP) {
        return of({
          status: CacheHitStatus.HIT,
          mode: CacheMode.ADAPTIVE,
          entryId: 'entry-1',
          cachedResponse: 'EU roaming includes 15 GB per month.',
          matchedQuery: 'What is EU roaming?',
          knowledgeSourceIds: ['doc-eu-1'],
          evaluation: {
            category: QueryCategory.PRODUCT_INQUIRY,
            cosineSimilarity: 0.94,
            adaptiveThreshold: 0.87,
            cacheStatus: CacheHitStatus.HIT,
            mode: CacheMode.ADAPTIVE,
          },
        });
      }
      throw new Error(`Unexpected cache call: ${pattern}`);
    });

    const { userId, dialogId, service } = createInMemoryDialogHarness({
      sendImpl: sendMock,
      kbSendImpl: kbSendMock,
      cacheSendImpl: cacheSendMock,
    });

    const turn = await service.sendMessage(userId, dialogId, {
      content: 'Can I use data in the EU?',
      category: QueryCategory.PRODUCT_INQUIRY,
      cacheMode: CacheMode.ADAPTIVE,
    });

    expect(turn.assistantMessage.content).toBe('EU roaming includes 15 GB per month.');
    expect(turn.assistantMessage.usage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
    expect(turn.cache?.status).toBe(CacheHitStatus.HIT);
    expect(kbSendMock).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('stores response with KB source IDs on semantic cache MISS and skips store on DISABLED', async () => {
    const sendMock = jest.fn((pattern: string) => {
      if (pattern === SERVICE_TCP_PATTERNS.LLM_EMBEDDINGS) {
        return createMockEmbeddingResponse();
      }
      return of({
        content: 'Autopay gives a 3% discount.',
        model: 'support-llm',
        latencyMs: 120,
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      });
    });
    const kbSendMock = jest.fn(() =>
      of({
        query: 'How do I enable autopay?',
        hasRelevantContext: true,
        formattedContext: 'Autopay context',
        results: [],
        sources: [
          {
            documentId: '11111111-1111-4111-8111-111111111111',
            documentTitle: 'Autopay',
            fileName: null,
            category: QueryCategory.BILLING,
            chunkId: '22222222-2222-4222-8222-222222222222',
            chunkIndex: 0,
          },
        ],
      }),
    );
    const cacheSendMock = jest.fn((pattern: string) => {
      if (pattern === SERVICE_TCP_PATTERNS.CACHE_LOOKUP) {
        return of({
          status: CacheHitStatus.MISS,
          mode: CacheMode.FIXED,
          evaluation: {
            category: QueryCategory.BILLING,
            cosineSimilarity: 0.2,
            adaptiveThreshold: 0.9,
            cacheStatus: CacheHitStatus.MISS,
            mode: CacheMode.FIXED,
          },
        });
      }
      return of({ id: 'stored-1' });
    });

    const { userId, dialogId, service } = createInMemoryDialogHarness({
      sendImpl: sendMock,
      kbSendImpl: kbSendMock,
      cacheSendImpl: cacheSendMock,
    });

    const missTurn = await service.sendMessage(userId, dialogId, {
      content: 'How do I enable autopay?',
      category: QueryCategory.BILLING,
      cacheMode: CacheMode.FIXED,
      fixedThresholdOverride: 0.9,
    });
    expect(missTurn.cache?.status).toBe(CacheHitStatus.MISS);
    expect(cacheSendMock).toHaveBeenCalledWith(
      SERVICE_TCP_PATTERNS.CACHE_STORE,
      expect.objectContaining({
        body: expect.objectContaining({
          knowledgeSourceIds: ['11111111-1111-4111-8111-111111111111'],
          category: QueryCategory.BILLING,
        }),
      }),
    );

    cacheSendMock.mockClear();
    const bypassTurn = await service.sendMessage(userId, dialogId, {
      content: 'What is my due date?',
      cacheMode: CacheMode.DISABLED,
    });
    expect(bypassTurn.cache?.status).toBe(CacheHitStatus.BYPASS);
    expect(cacheSendMock).not.toHaveBeenCalled();
  });
});
