import { KNOWLEDGE_BASE_VALIDATION_LIMITS } from '@semcache/shared-dtos';

export const DEFAULT_LOCAL_EMBEDDING_MODEL = 'local/deterministic-384';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'will',
  'with',
]);

function fnv1a32(input: string, seed = 2166136261): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function stemToken(token: string): string {
  if (token.length <= 4) {
    return token;
  }
  if (token.endsWith('ing') && token.length > 6) {
    return token.slice(0, -3);
  }
  if (token.endsWith('ies') && token.length > 5) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('ed') && token.length > 5) {
    return token.slice(0, -2);
  }
  if (token.endsWith('es') && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

function addWeightedFeature(
  vector: Float64Array,
  feature: string,
  weight: number,
  dimensions: number,
): void {
  const indexHash = fnv1a32(feature, 0x811c9dc5);
  const signHash = fnv1a32(feature, 0x9e3779b9);
  const index = indexHash % dimensions;
  const sign = (signHash & 1) === 0 ? 1 : -1;
  vector[index] = (vector[index] ?? 0) + sign * weight;
}

export function normalizeEmbeddingVector(
  rawVector: readonly number[],
  targetDimensions = KNOWLEDGE_BASE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS,
): number[] {
  const result = new Array<number>(targetDimensions).fill(0);
  const copyLength = Math.min(rawVector.length, targetDimensions);
  let normSq = 0;

  for (let i = 0; i < copyLength; i += 1) {
    const val = rawVector[i] ?? 0;
    result[i] = val;
    normSq += val * val;
  }

  if (normSq <= 0) {
    result[0] = 1;
    return result;
  }

  const norm = Math.sqrt(normSq);
  for (let i = 0; i < targetDimensions; i += 1) {
    result[i] = Number(((result[i] ?? 0) / norm).toFixed(8));
  }
  return result;
}

/**
 * Generates a deterministic, L2-normalized semantic feature-hashing vector
 * combining unigrams, stemmed tokens, bigrams, and character n-grams.
 */
export function computeDeterministicEmbedding(
  text: string,
  dimensions = KNOWLEDGE_BASE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS,
): number[] {
  const vector = new Float64Array(dimensions);
  const normalized = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length === 0) {
    vector[0] = 1;
    return Array.from(vector);
  }

  const rawTokens = normalized.split(' ').filter((token) => token.length > 0);
  const contentTokens = rawTokens.filter((token) => !STOP_WORDS.has(token) && token.length > 1);
  const tokens = contentTokens.length > 0 ? contentTokens : rawTokens;

  const termCounts = new Map<string, number>();
  for (const token of tokens) {
    termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
  }

  for (const [token, count] of termCounts.entries()) {
    const tfWeight = 1 + Math.log(count);
    addWeightedFeature(vector, `u:${token}`, tfWeight * 2.0, dimensions);

    const stem = stemToken(token);
    if (stem !== token) {
      addWeightedFeature(vector, `s:${stem}`, tfWeight * 1.4, dimensions);
    }

    if (token.length >= 3) {
      for (let i = 0; i <= token.length - 3; i += 1) {
        addWeightedFeature(vector, `c3:${token.slice(i, i + 3)}`, tfWeight * 0.45, dimensions);
      }
    }
    if (token.length >= 4) {
      for (let i = 0; i <= token.length - 4; i += 1) {
        addWeightedFeature(vector, `c4:${token.slice(i, i + 4)}`, tfWeight * 0.35, dimensions);
      }
    }
  }

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const first = tokens[i];
    const second = tokens[i + 1];
    if (first && second) {
      addWeightedFeature(vector, `b:${first}_${second}`, 1.25, dimensions);
    }
  }

  return normalizeEmbeddingVector(Array.from(vector), dimensions);
}

export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(trimmed.length / 4));
}
