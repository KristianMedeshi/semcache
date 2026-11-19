import type { UserResponseDto } from '@semcache/shared-dtos';
import type { UserRole } from '@semcache/shared-types';
import { redirect } from '@tanstack/react-router';

export interface RouteGuardOptions {
  /** Destination when unauthenticated (defaults to `/sign-in`). */
  signInHref?: string;
  /** Destination when authenticated but lacking the required role (defaults to `/`). */
  forbiddenHref?: string;
  /** Original location preserved for post-login redirect. */
  redirectTo?: string;
}

/**
 * Ensures a route has an authenticated user, throwing a TanStack Router redirect otherwise.
 */
export function requireAuthenticatedUser(
  user: UserResponseDto | null,
  options: RouteGuardOptions = {},
): UserResponseDto {
  if (!user) {
    const signInHref = options.signInHref ?? '/sign-in';
    const target = options.redirectTo
      ? `${signInHref}?redirect=${encodeURIComponent(options.redirectTo)}`
      : signInHref;
    throw redirect({ href: target });
  }
  return user;
}

/**
 * Ensures the authenticated user holds one of the allowed RBAC roles (e.g. CUSTOMER or ADMIN).
 */
export function requireRole(
  user: UserResponseDto | null,
  allowedRoles: readonly UserRole[],
  options: RouteGuardOptions = {},
): UserResponseDto {
  const authenticatedUser = requireAuthenticatedUser(user, options);
  if (!allowedRoles.includes(authenticatedUser.role)) {
    throw redirect({ href: options.forbiddenHref ?? '/' });
  }
  return authenticatedUser;
}

/**
 * Redirects already-authenticated users away from guest-only routes (e.g. Sign In / Sign Up).
 */
export function redirectIfAuthenticated(user: UserResponseDto | null, destinationHref = '/'): void {
  if (user) {
    throw redirect({ href: destinationHref });
  }
}
