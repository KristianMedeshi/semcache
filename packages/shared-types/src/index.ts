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
 * Role-based access control roles.
 */
export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

/**
 * Authenticated user principal attached to verified requests.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

/**
 * Internal HTTP headers used exclusively between API Gateway and backend microservices.
 * External requests carrying these headers must have them stripped at the gateway boundary.
 */
export const INTERNAL_AUTH_HEADERS = {
  USER_ID: 'x-internal-user-id',
  USER_EMAIL: 'x-internal-user-email',
  USER_ROLE: 'x-internal-user-role',
  SESSION_ID: 'x-internal-session-id',
  SIGNATURE: 'x-internal-auth-signature',
} as const;

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
