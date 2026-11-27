import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type {
  DialogStatsResponseDto,
  KnowledgeDocumentResponseDto,
  SemanticCacheSettingsResponseDto,
  SemanticCacheStatsResponseDto,
  UserResponseDto,
} from '@semcache/shared-dtos';
import {
  CacheMode,
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
  UserRole,
} from '@semcache/shared-types';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminClient from '@/features/admin/api/admin.client';
import * as authHooks from '@/features/auth/model/use-auth';
import * as kbClient from '@/features/knowledge-base/api/knowledge-base.client';
import { OperatorAdminPage } from '@/pages/admin/ui/operator-admin-page';
import { createAppQueryClient } from '@/shared/api/query-client';

vi.mock('@/features/auth/model/use-auth', () => ({
  useCurrentUserQuery: vi.fn(),
}));

vi.mock('@/features/admin/api/admin.client', () => ({
  getSemanticCacheSettings: vi.fn(),
  updateSemanticCacheSettings: vi.fn(),
  getSemanticCacheStats: vi.fn(),
  invalidateSemanticCacheBySources: vi.fn(),
  invalidateSemanticCacheByCategory: vi.fn(),
  clearAllSemanticCache: vi.fn(),
  getAdminDialogStats: vi.fn(),
}));

vi.mock('@/features/knowledge-base/api/knowledge-base.client', () => ({
  listKnowledgeDocuments: vi.fn(),
}));

const adminUser: UserResponseDto = {
  id: 'admin-1',
  email: 'operator@semcache.telecom',
  role: UserRole.ADMIN,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const customerUser: UserResponseDto = {
  ...adminUser,
  id: 'customer-1',
  email: 'customer@example.com',
  role: UserRole.CUSTOMER,
};

const sampleSettings: SemanticCacheSettingsResponseDto = {
  id: 'default',
  mode: CacheMode.ADAPTIVE,
  fixedThreshold: 0.9,
  adaptiveBaseThreshold: 0.85,
  minAdaptiveThreshold: 0.72,
  maxAdaptiveThreshold: 0.97,
  densityWeight: 0.08,
  densityKNeighbors: 5,
  categoryWeights: {
    [QueryCategory.BILLING]: 0.05,
    [QueryCategory.TECHNICAL_SUPPORT]: 0.01,
    [QueryCategory.ACCOUNT_MANAGEMENT]: 0.04,
    [QueryCategory.PRODUCT_INQUIRY]: -0.02,
    [QueryCategory.GENERAL]: -0.03,
  },
  updatedBy: adminUser.id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:05:00.000Z',
};

const sampleCacheStats: SemanticCacheStatsResponseDto = {
  mode: CacheMode.ADAPTIVE,
  totalEntries: 15,
  totalHits: 42,
  byCategory: [
    { category: QueryCategory.BILLING, entryCount: 6, totalHits: 20 },
    { category: QueryCategory.TECHNICAL_SUPPORT, entryCount: 4, totalHits: 12 },
    { category: QueryCategory.ACCOUNT_MANAGEMENT, entryCount: 2, totalHits: 5 },
    { category: QueryCategory.PRODUCT_INQUIRY, entryCount: 2, totalHits: 3 },
    { category: QueryCategory.GENERAL, entryCount: 1, totalHits: 2 },
  ],
};

const sampleDialogStats: DialogStatsResponseDto = {
  totalDialogs: 18,
  activeUsersCount: 6,
  totalMessages: 64,
  userMessages: 32,
  assistantMessages: 32,
  cachedAssistantMessages: 19,
  llmAssistantMessages: 13,
  cacheHitRate: 0.5938,
  averageLatencyMs: 210,
  averageCachedLatencyMs: 14,
  averageLlmLatencyMs: 496,
  totalTokens: 9600,
  promptTokens: 6400,
  completionTokens: 3200,
  recentDialogs: [
    {
      id: 'dialog-1',
      userId: customerUser.id,
      title: 'EU Roaming Allowance',
      messageCount: 4,
      updatedAt: '2026-01-02T10:00:00.000Z',
    },
  ],
};

const sampleDocs: KnowledgeDocumentResponseDto[] = [
  {
    id: 'doc-1',
    title: 'EU Roaming Guide',
    fileName: 'roaming.md',
    format: KnowledgeDocumentFormat.MARKDOWN,
    category: QueryCategory.PRODUCT_INQUIRY,
    status: KnowledgeDocumentStatus.READY,
    chunkCount: 3,
    characterCount: 1450,
    errorMessage: null,
    metadata: {},
    uploadedBy: adminUser.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:01:00.000Z',
  },
];

function renderOperatorAdminPage() {
  const client = createAppQueryClient();
  const rootRoute = createRootRoute();
  const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin',
    component: OperatorAdminPage,
  });
  const kbRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/knowledge-base',
    component: () => <div>KB</div>,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div>Home</div>,
  });
  const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sign-in',
    component: () => <div>Sign In</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([adminRoute, kbRoute, indexRoute, signInRoute]),
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
  });

  return render(
    <QueryClientProvider client={client}>
      <Toaster />
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function setupAdminTest() {
  vi.mocked(authHooks.useCurrentUserQuery).mockReturnValue({
    data: adminUser,
    isPending: false,
  } as ReturnType<typeof authHooks.useCurrentUserQuery>);
  vi.mocked(adminClient.getSemanticCacheSettings).mockResolvedValue(sampleSettings);
  vi.mocked(adminClient.getSemanticCacheStats).mockResolvedValue(sampleCacheStats);
  vi.mocked(adminClient.getAdminDialogStats).mockResolvedValue(sampleDialogStats);
  vi.mocked(kbClient.listKnowledgeDocuments).mockResolvedValue(sampleDocs);
}

describe('OperatorAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies access to non-admin customers', async () => {
    vi.mocked(authHooks.useCurrentUserQuery).mockReturnValue({
      data: customerUser,
      isPending: false,
    } as ReturnType<typeof authHooks.useCurrentUserQuery>);

    renderOperatorAdminPage();

    expect(await screen.findByText('Operator Access Required')).toBeVisible();
    expect(adminClient.getSemanticCacheSettings).not.toHaveBeenCalled();
  });

  it('displays dialog statistics and supports semantic cache mode switching and parameter validation/saving', async () => {
    const user = userEvent.setup();
    setupAdminTest();

    vi.mocked(adminClient.updateSemanticCacheSettings).mockResolvedValueOnce({
      ...sampleSettings,
      mode: CacheMode.FIXED,
    });
    vi.mocked(adminClient.updateSemanticCacheSettings).mockResolvedValueOnce({
      ...sampleSettings,
      mode: CacheMode.FIXED,
      fixedThreshold: 0.92,
    });

    renderOperatorAdminPage();

    expect(await screen.findByText('59.4%')).toBeVisible();
    expect(screen.getByText('14 ms')).toBeVisible();
    expect(screen.getByText('496 ms')).toBeVisible();
    expect(screen.getByText('EU Roaming Allowance')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Fixed' }));
    await waitFor(() => {
      expect(adminClient.updateSemanticCacheSettings).toHaveBeenCalledWith({
        mode: CacheMode.FIXED,
      });
    });

    const minInput = screen.getByLabelText('Min Adaptive Threshold');
    await user.clear(minInput);
    await user.type(minInput, '0.99');
    await user.click(screen.getByRole('button', { name: 'Save Parameters' }));
    expect(
      await screen.findByText(
        'Minimum adaptive threshold must be less than or equal to maximum adaptive threshold.',
      ),
    ).toBeVisible();

    await user.clear(minInput);
    await user.type(minInput, '0.72');
    const fixedInput = screen.getByLabelText('Fixed Threshold');
    await user.clear(fixedInput);
    await user.type(fixedInput, '0.92');
    await user.click(screen.getByRole('button', { name: 'Save Parameters' }));

    await waitFor(() => {
      expect(adminClient.updateSemanticCacheSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fixedThreshold: 0.92,
          minAdaptiveThreshold: 0.72,
        }),
      );
    });
  });

  it('supports invalidating by category, by KB source, and clearing all cache entries', async () => {
    const user = userEvent.setup();
    setupAdminTest();

    vi.mocked(adminClient.invalidateSemanticCacheByCategory).mockResolvedValueOnce({
      invalidatedCount: 6,
      scope: 'category',
      category: QueryCategory.BILLING,
    });
    vi.mocked(adminClient.invalidateSemanticCacheBySources).mockResolvedValueOnce({
      invalidatedCount: 2,
      scope: 'sources',
      documentIds: ['doc-1'],
    });
    vi.mocked(adminClient.clearAllSemanticCache).mockResolvedValueOnce({
      invalidatedCount: 15,
      scope: 'all',
    });

    renderOperatorAdminPage();

    await user.click(await screen.findByRole('button', { name: 'Invalidate Billing' }));
    await waitFor(() => {
      expect(adminClient.invalidateSemanticCacheByCategory).toHaveBeenCalledWith(
        QueryCategory.BILLING,
      );
    });

    const docSelect = screen.getByLabelText('Select Knowledge Base document');
    await user.selectOptions(docSelect, 'doc-1');
    await user.click(screen.getByRole('button', { name: 'Invalidate Linked' }));
    await waitFor(() => {
      expect(adminClient.invalidateSemanticCacheBySources).toHaveBeenCalledWith({
        documentIds: ['doc-1'],
      });
    });

    await user.click(screen.getByRole('button', { name: 'Clear All Cache Entries' }));
    const confirmDialog = await screen.findByRole('dialog');
    await user.click(within(confirmDialog).getByRole('button', { name: 'Confirm Clear All' }));
    await waitFor(() => {
      expect(adminClient.clearAllSemanticCache).toHaveBeenCalledTimes(1);
    });
  });
});
