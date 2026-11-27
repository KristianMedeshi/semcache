import type {
  CacheInvalidationResponseDto,
  DialogStatsResponseDto,
  InvalidateCacheBySourcesRequestDto,
  SemanticCacheSettingsResponseDto,
  SemanticCacheStatsResponseDto,
  UpdateSemanticCacheSettingsRequestDto,
} from '@semcache/shared-dtos';
import type { QueryCategory } from '@semcache/shared-types';
import { apiClient } from '@/shared/api/api-client';

export async function getSemanticCacheSettings(): Promise<SemanticCacheSettingsResponseDto> {
  const { data } = await apiClient.get<SemanticCacheSettingsResponseDto>(
    '/admin/semantic-cache/settings',
  );
  return data;
}

export async function updateSemanticCacheSettings(
  dto: UpdateSemanticCacheSettingsRequestDto,
): Promise<SemanticCacheSettingsResponseDto> {
  const { data } = await apiClient.patch<SemanticCacheSettingsResponseDto>(
    '/admin/semantic-cache/settings',
    dto,
  );
  return data;
}

export async function getSemanticCacheStats(): Promise<SemanticCacheStatsResponseDto> {
  const { data } = await apiClient.get<SemanticCacheStatsResponseDto>(
    '/admin/semantic-cache/stats',
  );
  return data;
}

export async function invalidateSemanticCacheBySources(
  dto: InvalidateCacheBySourcesRequestDto,
): Promise<CacheInvalidationResponseDto> {
  const { data } = await apiClient.post<CacheInvalidationResponseDto>(
    '/admin/semantic-cache/invalidate/sources',
    dto,
  );
  return data;
}

export async function invalidateSemanticCacheByCategory(
  category: QueryCategory,
): Promise<CacheInvalidationResponseDto> {
  const { data } = await apiClient.delete<CacheInvalidationResponseDto>(
    `/admin/semantic-cache/entries/category/${encodeURIComponent(category)}`,
  );
  return data;
}

export async function clearAllSemanticCache(): Promise<CacheInvalidationResponseDto> {
  const { data } = await apiClient.delete<CacheInvalidationResponseDto>(
    '/admin/semantic-cache/entries',
  );
  return data;
}

export async function getAdminDialogStats(): Promise<DialogStatsResponseDto> {
  const { data } = await apiClient.get<DialogStatsResponseDto>('/admin/dialogs/stats');
  return data;
}
