import { createTestAuthenticatedUser } from '@semcache/shared-config/testing';
import { UserRole } from '@semcache/shared-types';
import { KnowledgeBasePolicy } from './knowledge-base.policy';

describe('KnowledgeBasePolicy', () => {
  let policy: KnowledgeBasePolicy;

  const customer = createTestAuthenticatedUser(UserRole.CUSTOMER);
  const admin = createTestAuthenticatedUser(UserRole.ADMIN);

  beforeEach(() => {
    policy = new KnowledgeBasePolicy();
  });

  it('allows internal RAG context retrieval', () => {
    expect(policy.retrieveContext(null)).toBe(true);
  });

  it('allows authenticated users to read documents and restricts management to admins', () => {
    expect(policy.readDocument(customer)).toBe(true);
    expect(policy.readDocument(admin)).toBe(true);
    expect(policy.readDocument(null)).toBe(false);
    expect(policy.manageDocuments(admin)).toBe(true);
    expect(policy.manageDocuments(customer)).toBe(false);
    expect(policy.manageDocuments(null)).toBe(false);
  });
});
