import type { UserResponseDto } from '@semcache/shared-dtos';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, createRoute, createRouter } from '@tanstack/react-router';
import { queryClient } from '@/lib/query-client';
import { redirectIfAuthenticated } from '@/lib/route-guards';
import { HomePage } from '@/routes/home-page';
import { RootLayout } from '@/routes/root-layout';
import { SignInPage } from '@/routes/sign-in-page';
import { SignUpPage } from '@/routes/sign-up-page';

export interface RouterContext {
  queryClient: QueryClient;
  getAuthUser: () => Promise<UserResponseDto | null>;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const user = await context.getAuthUser();
    redirectIfAuthenticated(user, '/');
  },
  component: SignInPage,
});

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up',
  beforeLoad: async ({ context }) => {
    const user = await context.getAuthUser();
    redirectIfAuthenticated(user, '/');
  },
  component: SignUpPage,
});

const routeTree = rootRoute.addChildren([indexRoute, signInRoute, signUpRoute]);

export function createAppRouter(context: RouterContext) {
  return createRouter({
    routeTree,
    context,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });
}

export const router = createAppRouter({
  queryClient,
  getAuthUser: async () => null,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
