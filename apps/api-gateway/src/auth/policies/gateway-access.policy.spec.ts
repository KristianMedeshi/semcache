import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { GatewayAccessPolicy } from './gateway-access.policy';

describe('GatewayAccessPolicy', () => {
  let policy: GatewayAccessPolicy;

  const customer: UserResponseDto = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'customer@example.com',
    role: UserRole.CUSTOMER,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const otherId = '22222222-2222-4222-8222-222222222222';

  const admin: UserResponseDto = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    policy = new GatewayAccessPolicy();
  });

  it('bypasses via before() only for admins', () => {
    expect(policy.before(admin)).toBe(true);
    expect(policy.before(customer)).toBeUndefined();
    expect(policy.before(null)).toBeUndefined();
  });

  it('allows proxyAuthRequest and restricts accessDialogs to authenticated users', () => {
    expect(policy.proxyAuthRequest(null)).toBe(true);
    expect(policy.accessDialogs(customer)).toBe(true);
    expect(policy.accessDialogs(admin)).toBe(true);
    expect(policy.accessDialogs(null)).toBe(false);
  });

  it('enforces ownership on viewProfile/updateProfile and admin role on manageUsers', () => {
    expect(policy.viewProfile(customer, customer.id)).toBe(true);
    expect(policy.viewProfile(customer, otherId)).toBe(false);
    expect(policy.updateProfile(customer, customer.id)).toBe(true);
    expect(policy.updateProfile(customer, otherId)).toBe(false);
    expect(policy.manageUsers(customer)).toBe(false);
    expect(policy.manageUsers(admin)).toBe(true);
  });
});
