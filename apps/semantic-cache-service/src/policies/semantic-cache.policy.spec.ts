import { type AuthenticatedUser, UserRole } from '@semcache/shared-types';
import { SemanticCachePolicy } from './semantic-cache.policy';

describe('SemanticCachePolicy', () => {
  let policy: SemanticCachePolicy;

  const customer: AuthenticatedUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'customer@example.com',
    role: UserRole.CUSTOMER,
    sessionId: 'sess-1',
  };

  const admin: AuthenticatedUser = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    sessionId: 'sess-2',
  };

  beforeEach(() => {
    policy = new SemanticCachePolicy();
  });

  it('allows internal cache lookup and store operations', () => {
    expect(policy.lookup(null)).toBe(true);
    expect(policy.store(null)).toBe(true);
  });

  it('restricts cache invalidation to admins', () => {
    expect(policy.invalidate(admin)).toBe(true);
    expect(policy.invalidate(customer)).toBe(false);
    expect(policy.invalidate(null)).toBe(false);
  });
});
