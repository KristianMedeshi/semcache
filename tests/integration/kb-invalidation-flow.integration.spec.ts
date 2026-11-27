import { randomUUID } from 'node:crypto';
import type { ClientProxy } from '@nestjs/microservices';
import type {
  GenerateEmbeddingsRequestDto,
  LlmChatCompletionRequestDto,
  RetrieveKnowledgeContextRequestDto,
  SemanticCacheLookupRequestDto,
  SemanticCacheStoreRequestDto,
  SemanticCacheTcpRequestDto,
} from '@semcache/shared-dtos';
import {
  CacheHitStatus,
  CacheMode,
  QueryCategory,
  SERVICE_TCP_PATTERNS,
} from '@semcache/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { from, of } from 'rxjs';
import * as dialogSchema from '../../apps/dialog-service/src/db/schema';
import { DialogGraphService } from '../../apps/dialog-service/src/dialogs/dialog-graph.service';
import { DialogsRepository } from '../../apps/dialog-service/src/dialogs/dialogs.repository';
import * as kbSchema from '../../apps/knowledge-base-service/src/db/schema';
import { DocumentProcessorService } from '../../apps/knowledge-base-service/src/knowledge-base/document-processor.service';
import { KnowledgeBaseRepository } from '../../apps/knowledge-base-service/src/knowledge-base/knowledge-base.repository';
import { KnowledgeBaseService } from '../../apps/knowledge-base-service/src/knowledge-base/knowledge-base.service';
import * as cacheSchema from '../../apps/semantic-cache-service/src/db/schema';
import { SemanticCacheRepository } from '../../apps/semantic-cache-service/src/semantic-cache/semantic-cache.repository';
import { SemanticCacheService } from '../../apps/semantic-cache-service/src/semantic-cache/semantic-cache.service';
import { ThresholdCalculatorService } from '../../apps/semantic-cache-service/src/semantic-cache/threshold-calculator.service';
import { loadIntegrationDatabaseUrl } from './test-db.helper';

function embedText(text: string): number[] {
  const lower = text.toLowerCase();
  const vec = Array.from({ length: 384 }, () => 0);
  if (lower.includes('autopay') || lower.includes('automatic payment')) {
    vec[200] = 1;
    vec[201] = lower.includes('turn on') ? 0.12 : 0.05;
  } else {
    vec[210] = 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => Number((v / norm).toFixed(8)));
}

describe('Cross-Service KB Update -> Cache Invalidation -> Dialog Flow (Real PostgreSQL)', () => {
  let pool: Pool;
  let cacheService: SemanticCacheService;
  let kbService: KnowledgeBaseService;
  let dialogGraph: DialogGraphService;
  let dialogsRepo: DialogsRepository;
  let kbRepo: KnowledgeBaseRepository;

  const testRunId = `int-flow-${randomUUID()}`;
  const createdDocIds: string[] = [];
  const createdDialogIds: string[] = [];
  let llmCalls = 0;

  beforeAll(() => {
    pool = new Pool({ connectionString: loadIntegrationDatabaseUrl('apps/dialog-service') });

    const cacheDb = drizzle(pool, { schema: cacheSchema });
    const cacheRepo = new SemanticCacheRepository(cacheDb);
    cacheService = new SemanticCacheService(cacheRepo, new ThresholdCalculatorService());

    const kbDb = drizzle(pool, { schema: kbSchema });
    kbRepo = new KnowledgeBaseRepository(kbDb);

    const dialogDb = drizzle(pool, { schema: dialogSchema });
    dialogsRepo = new DialogsRepository(dialogDb);

    const embeddingClient = {
      send: (_pattern: string, payload: GenerateEmbeddingsRequestDto) =>
        of({
          embeddings: payload.texts.map(embedText),
          model: 'test-deterministic-384',
          dimensions: 384,
          latencyMs: 1,
          usage: { totalTokens: 10 },
        }),
    } as unknown as ClientProxy;

    const asyncSemanticCacheClient = {
      send: (pattern: string, payload: SemanticCacheTcpRequestDto<unknown>) => {
        if (pattern === SERVICE_TCP_PATTERNS.CACHE_LOOKUP) {
          return from(cacheService.lookup(payload.body as SemanticCacheLookupRequestDto));
        }
        if (pattern === SERVICE_TCP_PATTERNS.CACHE_STORE) {
          return from(
            cacheService.store({
              ...(payload.body as SemanticCacheStoreRequestDto),
              metadata: {
                ...((payload.body as SemanticCacheStoreRequestDto).metadata ?? {}),
                testRunId,
              },
            }),
          );
        }
        if (pattern === SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES) {
          const body = payload.body as { documentIds: string[] };
          return from(cacheService.invalidateBySources(body.documentIds));
        }
        if (pattern === SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_UNLINKED) {
          return from(cacheService.invalidateUnlinked());
        }
        throw new Error(`Unexpected cache pattern: ${pattern}`);
      },
    } as unknown as ClientProxy;

    kbService = new KnowledgeBaseService(
      kbRepo,
      new DocumentProcessorService(),
      embeddingClient,
      undefined,
      asyncSemanticCacheClient,
    );

    const kbClient = {
      send: (pattern: string, payload: { body: RetrieveKnowledgeContextRequestDto }) => {
        if (pattern === SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE) {
          return from(kbService.retrieveContext(payload.body));
        }
        throw new Error(`Unexpected KB pattern: ${pattern}`);
      },
    } as unknown as ClientProxy;

    const llmClient = {
      send: (_pattern: string, payload: LlmChatCompletionRequestDto) => {
        llmCalls += 1;
        const systemMsg = payload.messages.find((m) => m.role === 'system')?.content ?? '';
        const discountMatch = /€\d+ monthly discount/.exec(systemMsg);
        const fact = discountMatch ? discountMatch[0] : 'standard policy';
        return of({
          content: `Autopay provides a ${fact}.`,
          model: 'test-llm',
          latencyMs: 12,
          usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        });
      },
    } as unknown as ClientProxy;

    dialogGraph = new DialogGraphService(
      dialogsRepo,
      llmClient,
      kbClient,
      undefined,
      asyncSemanticCacheClient,
      embeddingClient,
    );
  });

  afterAll(async () => {
    const cacheDb = drizzle(pool, { schema: cacheSchema });
    await cacheDb
      .delete(cacheSchema.semanticCacheEntries)
      .where(sql`${cacheSchema.semanticCacheEntries.metadata}->>'testRunId' = ${testRunId}`);

    for (const docId of createdDocIds) {
      await kbRepo.deleteDocument(docId);
    }

    const dialogDb = drizzle(pool, { schema: dialogSchema });
    for (const dialogId of createdDialogIds) {
      await dialogDb.delete(dialogSchema.dialogs).where(sql`id = ${dialogId}`);
    }

    await pool.end();
  });

  it('caches KB-grounded answer, serves paraphrase hit, invalidates on KB reprocess, and serves updated v2 answer', async () => {
    const doc = await kbService.uploadDocument({
      title: `[${testRunId}] Autopay Policy`,
      content: 'Customers enabling autopay receive a €2 monthly discount on postpaid plans.',
      category: QueryCategory.BILLING,
    });
    createdDocIds.push(doc.id);

    const dialog = await dialogsRepo.createDialog(randomUUID(), `Integration Test ${testRunId}`);
    createdDialogIds.push(dialog.id);

    // 1. First query -> MISS -> RAG v1 -> LLM -> stored with source binding
    const turn1 = await dialogGraph.executeTurn({
      dialog,
      content: 'What discount does autopay give?',
      category: QueryCategory.BILLING,
      cacheMode: CacheMode.FIXED,
      fixedThresholdOverride: 0.9,
    });
    expect(turn1.cache?.status).toBe(CacheHitStatus.MISS);
    expect(turn1.assistantMessage.content).toContain('€2 monthly discount');
    expect(llmCalls).toBe(1);

    // 2. Paraphrased query -> HIT from pgvector semantic cache (LLM not called)
    const turn2 = await dialogGraph.executeTurn({
      dialog: turn1.dialog,
      content: 'How much do I save if I turn on automatic payment?',
      category: QueryCategory.BILLING,
      cacheMode: CacheMode.FIXED,
      fixedThresholdOverride: 0.9,
      parentMessageId: null,
    });
    expect(turn2.cache?.status).toBe(CacheHitStatus.HIT);
    expect(turn2.assistantMessage.content).toContain('€2 monthly discount');
    expect(llmCalls).toBe(1);

    // 3. Reprocess KB document with v2 fact -> triggers automatic source-bound cache invalidation
    await kbService.reprocessDocument(doc.id, {
      content: 'Customers enabling autopay receive a €4 monthly discount on postpaid plans.',
    });

    // 4. Follow-up query -> MISS (stale entry invalidated) -> RAG v2 -> fresh €4 answer
    const turn3 = await dialogGraph.executeTurn({
      dialog: turn2.dialog,
      content: 'How much do I save if I turn on automatic payment?',
      category: QueryCategory.BILLING,
      cacheMode: CacheMode.FIXED,
      fixedThresholdOverride: 0.9,
      parentMessageId: null,
    });
    expect(turn3.cache?.status).toBe(CacheHitStatus.MISS);
    expect(turn3.assistantMessage.content).toContain('€4 monthly discount');
    expect(llmCalls).toBe(2);
  });
});
