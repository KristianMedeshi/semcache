import { CacheMode, QueryCategory } from '@semcache/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/api-client';
import {
  clearAllSemanticCache,
  getAdminDialogStats,
  getSemanticCacheSettings,
  getSemanticCacheStats,
  invalidateSemanticCacheByCategory,
  invalidateSemanticCacheBySources,
  updateSemanticCacheSettings,
} from './admin.client';

vi.mock('@/shared/api/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('admin.client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and updates semantic cache settings', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { mode: CacheMode.ADAPTIVE } });
    const settings = await getSemanticCacheSettings();
    expect(apiClient.get).toHaveBeenCalledWith('/admin/semantic-cache/settings');
    expect(settings.mode).toBe(CacheMode.ADAPTIVE);

    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { mode: CacheMode.FIXED } });
    const updated = await updateSemanticCacheSettings({
      mode: CacheMode.FIXED,
      fixedThreshold: 0.9,
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/semantic-cache/settings', {
      mode: CacheMode.FIXED,
      fixedThreshold: 0.9,
    });
    expect(updated.mode).toBe(CacheMode.FIXED);
  });

  it('fetches semantic cache stats and dialog stats', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { totalEntries: 12 } });
    const cacheStats = await getSemanticCacheStats();
    expect(apiClient.get).toHaveBeenCalledWith('/admin/semantic-cache/stats');
    expect(cacheStats.totalEntries).toBe(12);

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { totalDialogs: 5 } });
    const dialogStats = await getAdminDialogStats();
    expect(apiClient.get).toHaveBeenCalledWith('/admin/dialogs/stats');
    expect(dialogStats.totalDialogs).toBe(5);
  });

  it('invalidates cache by sources, by category, and clears all entries', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { invalidatedCount: 2 } });
    await invalidateSemanticCacheBySources({ documentIds: ['doc-1'] });
    expect(apiClient.post).toHaveBeenCalledWith('/admin/semantic-cache/invalidate/sources', {
      documentIds: ['doc-1'],
    });

    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: { invalidatedCount: 1 } });
    await invalidateSemanticCacheByCategory(QueryCategory.BILLING);
    expect(apiClient.delete).toHaveBeenCalledWith(
      `/admin/semantic-cache/entries/category/${QueryCategory.BILLING}`,
    );

    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: { invalidatedCount: 10 } });
    await clearAllSemanticCache();
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/semantic-cache/entries');
  });
});
