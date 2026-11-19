import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { isRedirect } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { redirectIfAuthenticated, requireAuthenticatedUser, requireRole } from '@/lib/route-guards';

const customerUser: UserResponseDto = {
  id: 'user-1',
  email: 'customer@example.com',
  role: UserRole.CUSTOMER,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const adminUser: UserResponseDto = {
  ...customerUser,
  id: 'admin-1',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
};

function catchRedirect(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
}

describe('route guards', () => {
  it('redirects unauthenticated users to sign-in with redirect param', () => {
    const thrown = catchRedirect(() => requireAuthenticatedUser(null, { redirectTo: '/customer' }));
    expect(isRedirect(thrown)).toBe(true);
  });

  it('allows authenticated users matching required role', () => {
    expect(requireRole(customerUser, [UserRole.CUSTOMER])).toEqual(customerUser);
    expect(requireRole(adminUser, [UserRole.ADMIN])).toEqual(adminUser);
  });

  it('redirects authenticated users lacking required role', () => {
    const thrown = catchRedirect(() => requireRole(customerUser, [UserRole.ADMIN]));
    expect(isRedirect(thrown)).toBe(true);
  });

  it('redirects authenticated users away from guest-only routes', () => {
    const thrown = catchRedirect(() => redirectIfAuthenticated(customerUser, '/'));
    expect(isRedirect(thrown)).toBe(true);
  });
});
