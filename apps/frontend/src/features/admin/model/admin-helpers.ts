import {
  DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS,
  SEMANTIC_CACHE_VALIDATION_LIMITS,
  type SemanticCacheCategoryWeightsDto,
} from '@semcache/shared-dtos';
import { CacheMode, QueryCategory } from '@semcache/shared-types';

export const CACHE_MODE_LABELS: Record<CacheMode, string> = {
  [CacheMode.DISABLED]: 'No Cache (Disabled)',
  [CacheMode.FIXED]: 'Fixed Threshold',
  [CacheMode.ADAPTIVE]: 'Adaptive Threshold',
};

export const CACHE_MODE_SHORT_LABELS: Record<CacheMode, string> = {
  [CacheMode.DISABLED]: 'Disabled',
  [CacheMode.FIXED]: 'Fixed',
  [CacheMode.ADAPTIVE]: 'Adaptive',
};

export const CACHE_MODE_DESCRIPTIONS: Record<CacheMode, string> = {
  [CacheMode.DISABLED]: 'Bypasses vector cache lookup; every query goes directly to RAG + LLM.',
  [CacheMode.FIXED]:
    'Uses a single static cosine similarity threshold across all query categories.',
  [CacheMode.ADAPTIVE]:
    'Computes a dynamic threshold from base threshold, query category weight, and local cluster density.',
};

export interface CacheSettingsFormValues {
  fixedThreshold: number;
  adaptiveBaseThreshold: number;
  minAdaptiveThreshold: number;
  maxAdaptiveThreshold: number;
  densityWeight: number;
  densityKNeighbors: number;
  categoryWeights: SemanticCacheCategoryWeightsDto;
}

export function getDefaultCacheSettingsFormValues(): CacheSettingsFormValues {
  return {
    fixedThreshold: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_FIXED_THRESHOLD,
    adaptiveBaseThreshold: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_BASE_THRESHOLD,
    minAdaptiveThreshold: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MIN_ADAPTIVE_THRESHOLD,
    maxAdaptiveThreshold: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MAX_ADAPTIVE_THRESHOLD,
    densityWeight: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_WEIGHT,
    densityKNeighbors: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_K_NEIGHBORS,
    categoryWeights: { ...DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS },
  };
}

export function formatLatencyMs(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `${value.toLocaleString()} ms`;
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function validateCacheSettingsForm(values: CacheSettingsFormValues): string | null {
  const {
    MIN_THRESHOLD,
    MAX_THRESHOLD,
    MIN_DENSITY_WEIGHT,
    MAX_DENSITY_WEIGHT,
    MIN_DENSITY_K_NEIGHBORS,
    MAX_DENSITY_K_NEIGHBORS,
    MIN_CATEGORY_WEIGHT,
    MAX_CATEGORY_WEIGHT,
  } = SEMANTIC_CACHE_VALIDATION_LIMITS;

  if (!inRange(values.fixedThreshold, MIN_THRESHOLD, MAX_THRESHOLD)) {
    return `Fixed threshold must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}.`;
  }
  if (!inRange(values.adaptiveBaseThreshold, MIN_THRESHOLD, MAX_THRESHOLD)) {
    return `Adaptive base threshold must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}.`;
  }
  if (!inRange(values.minAdaptiveThreshold, MIN_THRESHOLD, MAX_THRESHOLD)) {
    return `Minimum adaptive threshold must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}.`;
  }
  if (!inRange(values.maxAdaptiveThreshold, MIN_THRESHOLD, MAX_THRESHOLD)) {
    return `Maximum adaptive threshold must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}.`;
  }
  if (values.minAdaptiveThreshold > values.maxAdaptiveThreshold) {
    return 'Minimum adaptive threshold must be less than or equal to maximum adaptive threshold.';
  }
  if (!inRange(values.densityWeight, MIN_DENSITY_WEIGHT, MAX_DENSITY_WEIGHT)) {
    return `Density weight must be between ${MIN_DENSITY_WEIGHT} and ${MAX_DENSITY_WEIGHT}.`;
  }
  if (
    !Number.isInteger(values.densityKNeighbors) ||
    !inRange(values.densityKNeighbors, MIN_DENSITY_K_NEIGHBORS, MAX_DENSITY_K_NEIGHBORS)
  ) {
    return `Density K neighbors must be an integer between ${MIN_DENSITY_K_NEIGHBORS} and ${MAX_DENSITY_K_NEIGHBORS}.`;
  }

  for (const category of Object.values(QueryCategory)) {
    if (!inRange(values.categoryWeights[category], MIN_CATEGORY_WEIGHT, MAX_CATEGORY_WEIGHT)) {
      return `Category weight for ${category} must be between ${MIN_CATEGORY_WEIGHT} and ${MAX_CATEGORY_WEIGHT}.`;
    }
  }

  return null;
}
