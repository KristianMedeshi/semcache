import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Toaster } from 'sonner';
import { useUiStore } from '@/features/theme/model/ui.store';

export function RootLayout() {
  const theme = useUiStore((state) => state.theme);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      <Toaster richColors position="top-right" theme={theme} />
      {import.meta.env.DEV ? (
        <>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          <TanStackRouterDevtools position="bottom-right" />
        </>
      ) : null}
    </div>
  );
}
