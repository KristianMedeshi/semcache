import { randomUUID } from 'node:crypto';
import type { AddressInfo, Server } from 'node:net';
import { type INestMicroservice, Injectable } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  type MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { createSignedInternalHeaders, extractRpcErrorPayload } from '@semcache/shared-config';
import type {
  CacheInvalidationResponseDto,
  CacheKnowledgeSourceReferenceDto,
  SemanticCacheEntryResponseDto,
  SemanticCacheLookupResponseDto,
  SemanticCacheSettingsResponseDto,
  SemanticCacheStatsResponseDto,
} from '@semcache/shared-dtos';
import {
  CacheHitStatus,
  CacheMode,
  QueryCategory,
  SERVICE_TCP_PATTERNS,
  ServiceName,
  UserRole,
} from '@semcache/shared-types';
import { firstValueFrom } from 'rxjs';
import { AppModule } from '../src/app.module';
import { SEMANTIC_CACHE_PG_POOL } from '../src/db/database.module';
import type { SemanticCacheEntryRecord, SemanticCacheSettingsRecord } from '../src/db/schema';
import {
  type DefaultSettingsSeed,
  SemanticCacheRepository,
} from '../src/semantic-cache/semantic-cache.repository';

function makeUnitVector(seed: number): number[] {
  const vec = Array.from({ length: 384 }, (_, idx) => (idx === seed % 384 ? 1 : 0.02));
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}

function cosineSim(a: number[], b: number[]): number {
  return a.reduce((sum, v, idx) => sum + v * (b[idx] ?? 0), 0);
}

@Injectable()
class InMemorySemanticCacheRepository {
  private readonly entries = new Map<string, SemanticCacheEntryRecord>();
  private readonly sourcesByEntry = new Map<string, CacheKnowledgeSourceReferenceDto[]>();
  private settings: SemanticCacheSettingsRecord | null = null;

  private ensureSettings(defaults: DefaultSettingsSeed): SemanticCacheSettingsRecord {
    if (!this.settings) {
      const now = new Date();
      this.settings = {
        id: 'default',
        mode: defaults.mode,
        fixedThreshold: defaults.fixedThreshold,
        adaptiveBaseThreshold: defaults.adaptiveBaseThreshold,
        minAdaptiveThreshold: defaults.minAdaptiveThreshold,
        maxAdaptiveThreshold: defaults.maxAdaptiveThreshold,
        densityWeight: defaults.densityWeight,
        densityKNeighbors: defaults.densityKNeighbors,
        categoryWeights: { ...defaults.categoryWeights },
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      };
    }
    return this.settings;
  }

  async getOrCreateSettings(defaults: DefaultSettingsSeed): Promise<SemanticCacheSettingsRecord> {
    return this.ensureSettings(defaults);
  }

  async updateSettings(
    defaults: DefaultSettingsSeed,
    updater: (current: SemanticCacheSettingsRecord) => Record<string, unknown>,
  ): Promise<SemanticCacheSettingsRecord> {
    const current = this.ensureSettings(defaults);
    this.settings = {
      ...current,
      ...(updater(current) as Partial<SemanticCacheSettingsRecord>),
      updatedAt: new Date(),
    };
    return this.settings;
  }

  async findNearestNeighbors(params: {
    embedding: number[];
    category: QueryCategory;
    limit: number;
  }) {
    return [...this.entries.values()]
      .filter((entry) => entry.category === params.category)
      .map((entry) => ({
        entry,
        similarity: cosineSim(params.embedding, entry.embedding),
        sources: this.sourcesByEntry.get(entry.id) ?? [],
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, params.limit);
  }

  async createEntry(input: {
    query: string;
    response: string;
    embedding: number[];
    category: QueryCategory;
    model?: string;
    metadata?: Record<string, string | number | boolean>;
    sources: CacheKnowledgeSourceReferenceDto[];
  }) {
    const now = new Date();
    const entry: SemanticCacheEntryRecord = {
      id: randomUUID(),
      query: input.query,
      response: input.response,
      embedding: input.embedding,
      category: input.category,
      model: input.model ?? null,
      hitCount: 0,
      lastHitAt: null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.entries.set(entry.id, entry);
    this.sourcesByEntry.set(entry.id, input.sources);
    return { entry, sources: input.sources };
  }

  async recordHit(entryId: string): Promise<void> {
    const entry = this.entries.get(entryId);
    if (entry) {
      entry.hitCount += 1;
      entry.lastHitAt = new Date();
    }
  }

  async invalidateByDocumentIds(documentIds: string[]): Promise<number> {
    const targetSet = new Set(documentIds);
    let count = 0;
    for (const [entryId, sources] of this.sourcesByEntry.entries()) {
      if (sources.some((s) => targetSet.has(s.documentId))) {
        this.entries.delete(entryId);
        this.sourcesByEntry.delete(entryId);
        count += 1;
      }
    }
    return count;
  }

  async invalidateByCategory(category: QueryCategory): Promise<number> {
    let count = 0;
    for (const [entryId, entry] of this.entries.entries()) {
      if (entry.category === category) {
        this.entries.delete(entryId);
        this.sourcesByEntry.delete(entryId);
        count += 1;
      }
    }
    return count;
  }

  async clearAll(): Promise<number> {
    const count = this.entries.size;
    this.entries.clear();
    this.sourcesByEntry.clear();
    return count;
  }

  async getStats() {
    const grouped = new Map<QueryCategory, { entryCount: number; totalHits: number }>();
    for (const entry of this.entries.values()) {
      const cat = entry.category as QueryCategory;
      const curr = grouped.get(cat) ?? { entryCount: 0, totalHits: 0 };
      curr.entryCount += 1;
      curr.totalHits += entry.hitCount;
      grouped.set(cat, curr);
    }
    return [...grouped.entries()].map(([category, stats]) => ({ category, ...stats }));
  }
}

describe('Semantic Cache Service (TCP e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  const originalEnv = { ...process.env };
  const secret = 'test-internal-service-secret-32-chars';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = secret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SemanticCacheRepository)
      .useClass(InMemorySemanticCacheRepository)
      .overrideProvider(SEMANTIC_CACHE_PG_POOL)
      .useValue({ end: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });
    await app.listen();

    const address = app.unwrap<Server>().address() as AddressInfo;
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: address.port },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    process.env = { ...originalEnv };
  });

  function createHeaders(role: UserRole) {
    return createSignedInternalHeaders(
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: role === UserRole.ADMIN ? 'admin@example.com' : 'customer@example.com',
        role,
        sessionId: 'sess-cache-e2e',
      },
      secret,
    );
  }

  it('app.hello and app.health return expected payloads', async () => {
    const hello = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HELLO, {}));
    expect(hello).toBe('Hello World!');

    const health = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HEALTH, {}));
    expect(health).toEqual({
      service: ServiceName.SEMANTIC_CACHE_SERVICE,
      status: 'ok',
      timestamp: expect.any(String),
    });
  });

  it('enforces RBAC on admin endpoints while allowing internal lookup/store', async () => {
    let unauthErr: unknown;
    try {
      await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET, { headers: {} }));
    } catch (error) {
      unauthErr = error;
    }
    expect(extractRpcErrorPayload(unauthErr)?.statusCode).toBe(401);

    let customerErr: unknown;
    try {
      await firstValueFrom(
        client.send(SERVICE_TCP_PATTERNS.CACHE_CLEAR_ALL, {
          headers: createHeaders(UserRole.CUSTOMER),
        }),
      );
    } catch (error) {
      customerErr = error;
    }
    expect(extractRpcErrorPayload(customerErr)?.statusCode).toBe(403);
  });

  it('stores entries, switches modes with overrides, reports stats, and invalidates by source, category, and all', async () => {
    const adminHeaders = createHeaders(UserRole.ADMIN);
    const docId = '11111111-1111-4111-8111-111111111111';
    const vecBilling = makeUnitVector(5);
    const vecTech = makeUnitVector(15);

    const storedBilling = await firstValueFrom(
      client.send<SemanticCacheEntryResponseDto>(SERVICE_TCP_PATTERNS.CACHE_STORE, {
        body: {
          query: 'How do I set up AutoPay?',
          response: 'Enable AutoPay in Billing settings.',
          embedding: vecBilling,
          category: QueryCategory.BILLING,
          knowledgeSourceIds: [docId],
        },
      }),
    );
    expect(storedBilling.knowledgeSourceIds).toEqual([docId]);

    await firstValueFrom(
      client.send<SemanticCacheEntryResponseDto>(SERVICE_TCP_PATTERNS.CACHE_STORE, {
        body: {
          query: 'My eSIM is not activating',
          response: 'Restart your device and re-scan the QR code.',
          embedding: vecTech,
          category: QueryCategory.TECHNICAL_SUPPORT,
        },
      }),
    );

    const adaptiveHit = await firstValueFrom(
      client.send<SemanticCacheLookupResponseDto>(SERVICE_TCP_PATTERNS.CACHE_LOOKUP, {
        body: {
          query: 'How do I set up AutoPay?',
          embedding: vecBilling,
          category: QueryCategory.BILLING,
        },
      }),
    );
    expect(adaptiveHit.status).toBe(CacheHitStatus.HIT);
    expect(adaptiveHit.mode).toBe(CacheMode.ADAPTIVE);

    const disabledSettings = await firstValueFrom(
      client.send<SemanticCacheSettingsResponseDto>(SERVICE_TCP_PATTERNS.CACHE_SETTINGS_UPDATE, {
        headers: adminHeaders,
        body: { mode: CacheMode.DISABLED },
      }),
    );
    expect(disabledSettings.mode).toBe(CacheMode.DISABLED);

    const bypassed = await firstValueFrom(
      client.send<SemanticCacheLookupResponseDto>(SERVICE_TCP_PATTERNS.CACHE_LOOKUP, {
        body: {
          query: 'How do I set up AutoPay?',
          embedding: vecBilling,
          category: QueryCategory.BILLING,
        },
      }),
    );
    expect(bypassed.status).toBe(CacheHitStatus.BYPASS);

    const fixedOverride = await firstValueFrom(
      client.send<SemanticCacheLookupResponseDto>(SERVICE_TCP_PATTERNS.CACHE_LOOKUP, {
        body: {
          query: 'How do I set up AutoPay?',
          embedding: vecBilling,
          category: QueryCategory.BILLING,
          mode: CacheMode.FIXED,
        },
      }),
    );
    expect(fixedOverride.status).toBe(CacheHitStatus.HIT);
    expect(fixedOverride.mode).toBe(CacheMode.FIXED);

    const stats = await firstValueFrom(
      client.send<SemanticCacheStatsResponseDto>(SERVICE_TCP_PATTERNS.CACHE_STATS_GET, {
        headers: adminHeaders,
      }),
    );
    expect(stats.totalEntries).toBe(2);
    expect(stats.totalHits).toBe(2);

    const invSources = await firstValueFrom(
      client.send<CacheInvalidationResponseDto>(SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES, {
        headers: adminHeaders,
        body: { documentIds: [docId] },
      }),
    );
    expect(invSources.invalidatedCount).toBe(1);

    const invCategory = await firstValueFrom(
      client.send<CacheInvalidationResponseDto>(SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_CATEGORY, {
        headers: adminHeaders,
        body: { category: QueryCategory.TECHNICAL_SUPPORT },
      }),
    );
    expect(invCategory.invalidatedCount).toBe(1);

    const cleared = await firstValueFrom(
      client.send<CacheInvalidationResponseDto>(SERVICE_TCP_PATTERNS.CACHE_CLEAR_ALL, {
        headers: adminHeaders,
      }),
    );
    expect(cleared.invalidatedCount).toBe(0);
  });
});
