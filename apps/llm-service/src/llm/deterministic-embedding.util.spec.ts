import { KNOWLEDGE_BASE_VALIDATION_LIMITS } from '@semcache/shared-dtos';
import { computeDeterministicEmbedding } from './deterministic-embedding.util';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

describe('computeDeterministicEmbedding', () => {
  it('produces unit-normalized vectors of the configured embedding dimension', () => {
    const vector = computeDeterministicEmbedding('5G Unlimited Plan includes EU roaming data');
    expect(vector).toHaveLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS);

    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('produces identical vectors for identical inputs', () => {
    const first = computeDeterministicEmbedding('How do I activate my eSIM QR code?');
    const second = computeDeterministicEmbedding('How do I activate my eSIM QR code?');
    expect(first).toEqual(second);
  });

  it('ranks semantically related telecom text higher than unrelated text', () => {
    const query = computeDeterministicEmbedding('How much EU roaming data is included?');
    const related = computeDeterministicEmbedding(
      'International EU roaming includes 25 GB high-speed data per billing cycle.',
    );
    const unrelated = computeDeterministicEmbedding(
      'Resetting your Wi-Fi router password on home fiber hardware.',
    );

    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });
});
