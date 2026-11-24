import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';
import { createAppRouter } from '@/app/router';
import { getCurrentUser } from '@/features/auth/api/auth.client';
import { applyThemeToDocument, useTheme } from '@/features/theme/model/ui.store';
import { onUnauthorizedResponse } from '@/shared/api/api-client';
import { queryClient, queryKeys } from '@/shared/api/query-client';

const appRouter = createAppRouter({
  queryClient,
  getAuthUser: () =>
    queryClient.query({
      queryKey: queryKeys.auth.me(),
      queryFn: getCurrentUser,
      staleTime: 'static',
    }),
});

export function App() {
  const { theme } = useTheme();

  useEffect(() => {
    applyThemeToDocument(theme);

    if (
      theme !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyThemeToDocument('system');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    return onUnauthorizedResponse(() => {
      queryClient.setQueryData(queryKeys.auth.me(), null);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={appRouter} />
    </QueryClientProvider>
  );
}

export default App;
