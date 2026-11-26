import { type FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import { EMBEDDING_VALIDATION_LIMITS } from '@semcache/shared-dtos';
import { DEFAULT_EMBEDDING_MODEL } from '../config/embedding.env';

export const DEFAULT_LOCAL_EMBEDDING_MODEL = DEFAULT_EMBEDDING_MODEL;

const pipelineCache = new Map<string, Promise<FeatureExtractionPipeline>>();

/**
 * Determines whether the given model identifier refers to a supported local
 * `@huggingface/transformers` embedding model (empty/blank string, the default
 * local model, or a `Xenova/` / `onnx-community/` model).
 */
export function isLocalTransformersEmbeddingModel(modelId: string): boolean {
  const trimmed = modelId.trim();
  return (
    trimmed.length === 0 ||
    trimmed === DEFAULT_LOCAL_EMBEDDING_MODEL ||
    trimmed.startsWith('Xenova/') ||
    trimmed.startsWith('onnx-community/')
  );
}

/**
 * Resolves an optional model identifier by trimming whitespace and falling back
 * to `DEFAULT_LOCAL_EMBEDDING_MODEL` when omitted or blank.
 */
export function resolveLocalEmbeddingModelId(modelId?: string): string {
  const trimmed = modelId?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : DEFAULT_LOCAL_EMBEDDING_MODEL;
}

/**
 * Clears the in-memory cache of `FeatureExtractionPipeline` promises so models
 * will be re-initialized on subsequent calls (e.g., in tests).
 */
export function resetFeatureExtractionPipelineCache(): void {
  pipelineCache.clear();
}

/**
 * Lazily initializes and caches a `fp32` `feature-extraction` pipeline for the
 * resolved local model ID, returning the shared promise for concurrent or
 * repeated requests.
 */
async function getFeatureExtractionPipeline(modelId: string): Promise<FeatureExtractionPipeline> {
  const resolvedModelId = resolveLocalEmbeddingModelId(modelId);
  let cached = pipelineCache.get(resolvedModelId);
  if (!cached) {
    cached = pipeline('feature-extraction', resolvedModelId, {
      dtype: 'fp32',
    });
    pipelineCache.set(resolvedModelId, cached);
  }
  return cached;
}

/**
 * Truncates or zero-pads `rawVector` to `targetDimensions` and L2-normalizes
 * the result (rounded to 8 decimal places). If the squared norm is non-positive,
 * returns a unit vector `[1, 0, ...]` of length `targetDimensions`.
 */
export function normalizeEmbeddingVector(
  rawVector: ArrayLike<number>,
  targetDimensions: number = EMBEDDING_VALIDATION_LIMITS.DIMENSIONS,
): number[] {
  const result = Array.from({ length: targetDimensions }, () => 0);
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
 * Generates L2-normalized multilingual embedding vectors for a batch of texts
 * using `@huggingface/transformers` (`feature-extraction` pipeline with mean
 * pooling and normalization), resizing each output row to `dimensions`.
 */
export async function computeTransformersEmbeddings(
  texts: string[],
  dimensions: number = EMBEDDING_VALIDATION_LIMITS.DIMENSIONS,
  modelId = DEFAULT_LOCAL_EMBEDDING_MODEL,
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const extractor = await getFeatureExtractionPipeline(modelId);
  const tensor = await extractor(texts, { pooling: 'mean', normalize: true });
  const rowSize =
    tensor.dims && tensor.dims.length >= 2 && tensor.dims[1] ? tensor.dims[1] : dimensions;
  const rawData = tensor.data as ArrayLike<number>;

  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += 1) {
    const start = i * rowSize;
    const end = start + rowSize;
    const slice = Array.prototype.slice.call(rawData, start, end) as number[];
    embeddings.push(normalizeEmbeddingVector(slice, dimensions));
  }

  return embeddings;
}

/**
 * Generates a single L2-normalized multilingual embedding vector for `text`
 * using `@huggingface/transformers`, falling back to a unit fallback vector
 * if no embedding is produced.
 */
export async function computeDeterministicEmbedding(
  text: string,
  dimensions: number = EMBEDDING_VALIDATION_LIMITS.DIMENSIONS,
  modelId = DEFAULT_LOCAL_EMBEDDING_MODEL,
): Promise<number[]> {
  const [embedding] = await computeTransformersEmbeddings([text], dimensions, modelId);
  return embedding ?? normalizeEmbeddingVector([], dimensions);
}

/**
 * Estimates the token count of `text` using a ~4 characters-per-token heuristic.
 * Returns `0` for blank input and at least `1` for any non-empty trimmed string.
 */
export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(trimmed.length / 4));
}
