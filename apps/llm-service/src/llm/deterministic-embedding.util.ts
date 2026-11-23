import { type FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import { KNOWLEDGE_BASE_VALIDATION_LIMITS } from '@semcache/shared-dtos';

export const DEFAULT_LOCAL_EMBEDDING_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

const pipelineCache = new Map<string, Promise<FeatureExtractionPipeline>>();

export function isLocalTransformersEmbeddingModel(modelId: string): boolean {
  const trimmed = modelId.trim();
  return (
    trimmed.length === 0 ||
    trimmed === DEFAULT_LOCAL_EMBEDDING_MODEL ||
    trimmed.startsWith('Xenova/') ||
    trimmed.startsWith('onnx-community/')
  );
}

export function resolveLocalEmbeddingModelId(modelId?: string): string {
  const trimmed = modelId?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : DEFAULT_LOCAL_EMBEDDING_MODEL;
}

export function resetFeatureExtractionPipelineCache(): void {
  pipelineCache.clear();
}

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

export function normalizeEmbeddingVector(
  rawVector: ArrayLike<number>,
  targetDimensions = KNOWLEDGE_BASE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS,
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
 * Generates L2-normalized multilingual embedding vectors using `@huggingface/transformers`
 * (`feature-extraction` pipeline with mean pooling and normalization).
 */
export async function computeTransformersEmbeddings(
  texts: string[],
  dimensions = KNOWLEDGE_BASE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS,
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
 * Generates a single L2-normalized multilingual embedding vector using `@huggingface/transformers`.
 */
export async function computeDeterministicEmbedding(
  text: string,
  dimensions = KNOWLEDGE_BASE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS,
  modelId = DEFAULT_LOCAL_EMBEDDING_MODEL,
): Promise<number[]> {
  const [embedding] = await computeTransformersEmbeddings([text], dimensions, modelId);
  return embedding ?? normalizeEmbeddingVector([], dimensions);
}

export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(trimmed.length / 4));
}
