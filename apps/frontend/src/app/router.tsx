import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, createRoute, createRouter } from '@tanstack/react-router';
import { RootLayout } from '@/app/root-layout';
import { ForgotPasswordPage } from '@/pages/forgot-password/ui/forgot-password-page';
import { HomePage } from '@/pages/home/ui/home-page';
import { KnowledgeBasePage } from '@/pages/knowledge-base/ui/knowledge-base-page';
import { SignInPage } from '@/pages/sign-in/ui/sign-in-page';
import { SignUpPage } from '@/pages/sign-up/ui/sign-up-page';
import { queryClient } from '@/shared/api/query-client';
import { redirectIfAuthenticated, requireRole } from '@/shared/lib/route-guards';

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

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  beforeLoad: async ({ context }) => {
    const user = await context.getAuthUser();
    redirectIfAuthenticated(user, '/');
  },
  component: ForgotPasswordPage,
});

const knowledgeBaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/knowledge-base',
  beforeLoad: async ({ context }) => {
    const user = await context.getAuthUser();
    requireRole(user, [UserRole.ADMIN], {
      redirectTo: '/knowledge-base',
      forbiddenHref: '/',
    });
  },
  component: KnowledgeBasePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signUpRoute,
  forgotPasswordRoute,
  knowledgeBaseRoute,
]);

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
