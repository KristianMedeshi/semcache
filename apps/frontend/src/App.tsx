import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';
import { getCurrentUser } from '@/api/auth.client';
import { onUnauthorizedResponse } from '@/lib/api-client';
import { queryClient, queryKeys } from '@/lib/query-client';
import { createAppRouter } from '@/router';
import { applyThemeToDocument, useUiStore } from '@/stores/ui.store';

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
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    applyThemeToDocument(theme);
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
