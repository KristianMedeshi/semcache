import { type AuthenticatedUser, UserRole } from '@semcache/shared-types';
import { KnowledgeBasePolicy } from './knowledge-base.policy';

describe('KnowledgeBasePolicy', () => {
  let policy: KnowledgeBasePolicy;

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
