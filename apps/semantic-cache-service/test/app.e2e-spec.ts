import { type INestMicroservice } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { extractRpcErrorPayload } from '@semcache/shared-config';
import {
  createE2eSignedHeaders,
  createTcpMicroserviceTestClient,
} from '@semcache/shared-config/testing';
import type {
  CacheInvalidationResponseDto,
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
import { SemanticCacheRepository } from '../src/semantic-cache/semantic-cache.repository';
import {
  InMemorySemanticCacheRepository,
  makeUnitVector as makeBaseUnitVector,
} from './in-memory-semantic-cache.repository';

const makeUnitVector = (seed: number) => makeBaseUnitVector(seed, 0.02);

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

    ({ app, client } = await createTcpMicroserviceTestClient(moduleFixture));
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    process.env = { ...originalEnv };
  });

  function createHeaders(role: UserRole) {
    return createE2eSignedHeaders(role, 'sess-cache-e2e', secret);
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

    let customerUnlinkedErr: unknown;
    try {
      await firstValueFrom(
        client.send(SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_UNLINKED, {
          headers: createHeaders(UserRole.CUSTOMER),
        }),
      );
    } catch (error) {
      customerUnlinkedErr = error;
    }
    expect(extractRpcErrorPayload(customerUnlinkedErr)?.statusCode).toBe(403);
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

    const invUnlinked = await firstValueFrom(
      client.send<CacheInvalidationResponseDto>(SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_UNLINKED, {
        headers: adminHeaders,
      }),
    );
    expect(invUnlinked).toEqual({
      invalidatedCount: 1,
      scope: 'unlinked',
    });

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
    expect(invCategory.invalidatedCount).toBe(0);

    const cleared = await firstValueFrom(
      client.send<CacheInvalidationResponseDto>(SERVICE_TCP_PATTERNS.CACHE_CLEAR_ALL, {
        headers: adminHeaders,
      }),
    );
    expect(cleared.invalidatedCount).toBe(0);
  });
});
