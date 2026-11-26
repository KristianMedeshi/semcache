import { EmbeddingPolicy } from './embedding.policy';

describe('EmbeddingPolicy', () => {
  let policy: EmbeddingPolicy;

  beforeEach(() => {
    policy = new EmbeddingPolicy();
  });

  it('allows internal embedding generation operations', () => {
    expect(policy.generateEmbeddings(null)).toBe(true);
  });
});
