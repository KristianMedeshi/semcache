import type {
  InvalidateCacheBySourcesRequestDto,
  UpdateSemanticCacheSettingsRequestDto,
} from '@semcache/shared-dtos';
import type { QueryCategory } from '@semcache/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clearAllSemanticCache,
  getAdminDialogStats,
  getSemanticCacheSettings,
  getSemanticCacheStats,
  invalidateSemanticCacheByCategory,
  invalidateSemanticCacheBySources,
  updateSemanticCacheSettings,
} from '@/features/admin/api/admin.client';
import { queryKeys } from '@/shared/api/query-client';

export function useSemanticCacheSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.semanticCache.settings(),
    queryFn: getSemanticCacheSettings,
  });
}

export function useUpdateSemanticCacheSettingsMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateSemanticCacheSettingsRequestDto) => updateSemanticCacheSettings(dto),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.semanticCache.settings(), updated);
      void client.invalidateQueries({ queryKey: queryKeys.semanticCache.stats() });
    },
  });
}

export function useSemanticCacheStatsQuery() {
  return useQuery({
    queryKey: queryKeys.semanticCache.stats(),
    queryFn: getSemanticCacheStats,
  });
}

export function useInvalidateCacheBySourcesMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (dto: InvalidateCacheBySourcesRequestDto) => invalidateSemanticCacheBySources(dto),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.semanticCache.stats() });
    },
  });
}

export function useInvalidateCacheByCategoryMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (category: QueryCategory) => invalidateSemanticCacheByCategory(category),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.semanticCache.stats() });
    },
  });
}

export function useClearAllSemanticCacheMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => clearAllSemanticCache(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.semanticCache.stats() });
    },
  });
}

export function useAdminDialogStatsQuery() {
  return useQuery({
    queryKey: queryKeys.dialogs.stats(),
    queryFn: getAdminDialogStats,
  });
}
