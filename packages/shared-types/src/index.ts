/**
 * Identifier of microservices within the SemCache architecture.
 */
export enum ServiceName {
  API_GATEWAY = 'api-gateway',
  AUTH_SERVICE = 'auth-service',
  DIALOG_SERVICE = 'dialog-service',
  SEMANTIC_CACHE_SERVICE = 'semantic-cache-service',
  LLM_SERVICE = 'llm-service',
  KNOWLEDGE_BASE_SERVICE = 'knowledge-base-service',
}

/**
 * High-level customer support query categories used for adaptive semantic threshold tuning.
 */
export enum QueryCategory {
  BILLING = 'billing',
  TECHNICAL_SUPPORT = 'technical_support',
  ACCOUNT_MANAGEMENT = 'account_management',
  PRODUCT_INQUIRY = 'product_inquiry',
  GENERAL = 'general',
}

/**
 * Semantic cache lookup outcome status.
 */
export enum CacheHitStatus {
  HIT = 'HIT',
  MISS = 'MISS',
  BYPASS = 'BYPASS',
}

/**
 * Standard metadata attached to semantic cache entries and vector evaluations.
 */
export interface SemanticEvaluationMetadata {
  category: QueryCategory;
  cosineSimilarity: number;
  adaptiveThreshold: number;
  localClusterDensity?: number;
  cacheStatus: CacheHitStatus;
}

/**
 * Standard service health status response type.
 */
export interface HealthCheckStatus {
  service: ServiceName | string;
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
}
