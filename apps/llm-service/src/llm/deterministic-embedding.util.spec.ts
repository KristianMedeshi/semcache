import { KNOWLEDGE_BASE_VALIDATION_LIMITS } from '@semcache/shared-dtos';
import {
  DEFAULT_LOCAL_EMBEDDING_MODEL,
  computeDeterministicEmbedding,
  computeTransformersEmbeddings,
} from './deterministic-embedding.util';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

describe('computeDeterministicEmbedding (@huggingface/transformers multilingual)', () => {
  it('uses Xenova/paraphrase-multilingual-MiniLM-L12-v2 as the default multilingual model', () => {
    expect(DEFAULT_LOCAL_EMBEDDING_MODEL).toBe('Xenova/paraphrase-multilingual-MiniLM-L12-v2');
  });

  it('produces unit-normalized 384-dimensional vectors', async () => {
    const vector = await computeDeterministicEmbedding(
      '5G Unlimited Plan includes EU roaming data',
    );
    expect(vector).toHaveLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS);

    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1, 5);
  }, 60_000);

  it('produces identical vectors for identical inputs and handles batch embeddings', async () => {
    const [first, second] = await computeTransformersEmbeddings([
      'How do I activate my eSIM QR code?',
      'How do I activate my eSIM QR code?',
    ]);
    expect(first).toEqual(second);
  }, 60_000);

  it('ranks semantically related multilingual telecom text higher than unrelated text', async () => {
    const query = await computeDeterministicEmbedding('How much EU roaming data is included?');
    const related = await computeDeterministicEmbedding(
      'International EU roaming includes 25 GB high-speed data per billing cycle.',
    );
    const unrelated = await computeDeterministicEmbedding(
      'How to bake a chocolate cake in a preheated oven.',
    );

    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  }, 60_000);
});
