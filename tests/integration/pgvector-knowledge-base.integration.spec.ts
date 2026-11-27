import { randomUUID } from 'node:crypto';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
} from '@semcache/shared-types';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../apps/knowledge-base-service/src/db/schema';
import { KnowledgeBaseRepository } from '../../apps/knowledge-base-service/src/knowledge-base/knowledge-base.repository';
import { loadIntegrationDatabaseUrl, makeUnitVector384 } from './test-db.helper';

describe('pgvector Knowledge Base Integration (Real PostgreSQL)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: KnowledgeBaseRepository;
  const createdDocIds: string[] = [];
  const runTag = randomUUID().slice(0, 8);

  beforeAll(() => {
    pool = new Pool({ connectionString: loadIntegrationDatabaseUrl('apps/knowledge-base-service') });
    db = drizzle(pool, { schema });
    repository = new KnowledgeBaseRepository(db);
  });

  afterAll(async () => {
    if (repository) {
      for (const docId of createdDocIds) {
        await repository.deleteDocument(docId);
      }
    }
    if (pool) {
      await pool.end();
    }
  });

  it('verifies kb_document_chunks HNSW cosine index exists in PostgreSQL', async () => {
    const idxResult = await pool.query<{ indexname: string; indexdef: string }>(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'kb_document_chunks' AND indexdef ILIKE '%hnsw%'",
    );
    expect(idxResult.rows.length).toBeGreaterThanOrEqual(1);
    expect(idxResult.rows[0]?.indexdef).toContain('vector_cosine_ops');
  });

  it('ranks READY chunks by cosine similarity, respects minSimilarity & category, and cascades delete', async () => {
    const billingDoc = await repository.createDocument({
      title: `[${runTag}] Billing Autopay Policy`,
      format: KnowledgeDocumentFormat.TEXT,
      category: QueryCategory.BILLING,
      rawContent: 'Autopay gives 3% monthly discount.',
      status: KnowledgeDocumentStatus.READY,
    });
    createdDocIds.push(billingDoc.id);

    const roamingDoc = await repository.createDocument({
      title: `[${runTag}] EU Roaming Policy`,
      format: KnowledgeDocumentFormat.TEXT,
      category: QueryCategory.PRODUCT_INQUIRY,
      rawContent: 'EU roaming includes 15 GB fair use.',
      status: KnowledgeDocumentStatus.READY,
    });
    createdDocIds.push(roamingDoc.id);

    await repository.replaceDocumentChunks(billingDoc.id, [
      {
        chunkIndex: 0,
        content: 'Autopay gives 3% monthly discount.',
        tokenCount: 8,
        characterCount: 34,
        embedding: makeUnitVector384(120),
        metadata: {},
      },
    ]);
    await repository.replaceDocumentChunks(roamingDoc.id, [
      {
        chunkIndex: 0,
        content: 'EU roaming includes 15 GB fair use.',
        tokenCount: 8,
        characterCount: 35,
        embedding: makeUnitVector384(125),
        metadata: {},
      },
    ]);

    const results = await repository.searchSimilarChunks({
      queryEmbedding: makeUnitVector384(120, 121, 0.1),
      topK: 3,
      minSimilarity: 0.85,
      category: QueryCategory.BILLING,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.documentId).toBe(billingDoc.id);
    expect(results[0]?.similarity).toBeGreaterThan(0.95);

    const deleted = await repository.deleteDocument(billingDoc.id);
    expect(deleted.deleted).toBe(true);
    expect(deleted.deletedChunksCount).toBe(1);
  });
});
