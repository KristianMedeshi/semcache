import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/api-client';

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },
  users: {
    all: ['users'] as const,
    detail: (userId: string) => [...queryKeys.users.all, 'detail', userId] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
  },
  dialogs: {
    all: ['dialogs'] as const,
    list: () => [...queryKeys.dialogs.all, 'list'] as const,
    messages: (dialogId: string) => [...queryKeys.dialogs.all, 'messages', dialogId] as const,
  },
  knowledgeBase: {
    all: ['knowledge-base'] as const,
    list: (filters?: { category?: string; status?: string }) =>
      [...queryKeys.knowledgeBase.all, 'list', filters ?? {}] as const,
    detail: (documentId: string) => [...queryKeys.knowledgeBase.all, 'detail', documentId] as const,
  },
} as const;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const queryClient = createAppQueryClient();
