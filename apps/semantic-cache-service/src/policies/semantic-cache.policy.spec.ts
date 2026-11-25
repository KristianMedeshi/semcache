import { createTestAuthenticatedUser } from '@semcache/shared-config/testing';
import { UserRole } from '@semcache/shared-types';
import { SemanticCachePolicy } from './semantic-cache.policy';

describe('SemanticCachePolicy', () => {
  let policy: SemanticCachePolicy;

  const customer = createTestAuthenticatedUser(UserRole.CUSTOMER);
  const admin = createTestAuthenticatedUser(UserRole.ADMIN);

  beforeEach(() => {
    policy = new SemanticCachePolicy();
  });

  it('allows internal cache lookup and store operations', () => {
    expect(policy.lookup(null)).toBe(true);
    expect(policy.store(null)).toBe(true);
  });

  it('restricts cache invalidation, settings management, and stats to admins', () => {
    expect(policy.invalidate(admin)).toBe(true);
    expect(policy.invalidate(customer)).toBe(false);
    expect(policy.invalidate(null)).toBe(false);

    expect(policy.manageSettings(admin)).toBe(true);
    expect(policy.manageSettings(customer)).toBe(false);
    expect(policy.manageSettings(null)).toBe(false);

    expect(policy.readStats(admin)).toBe(true);
    expect(policy.readStats(customer)).toBe(false);
    expect(policy.readStats(null)).toBe(false);
  });
});
