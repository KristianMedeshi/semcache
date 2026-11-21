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
 * Chat message author roles aligned with OpenRouter/LLM chat completions.
 */
export enum ChatMessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
}

/**
 * Curated list of zero-cost OpenRouter models permitted in SemCache.
 */
export const FREE_OPENROUTER_MODELS = [
  'openrouter/free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'baidu/ernie-5.5-flash-preview:free',
  'liquid/lfm-3-1.7b:free',
  'recursive/flint-v1.0:free',
] as const;

export type FreeOpenRouterModelId = (typeof FREE_OPENROUTER_MODELS)[number];

/**
 * Standard service health status response type.
 */
export interface HealthCheckStatus {
  service: ServiceName | string;
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
}

/**
 * Canonical TCP message patterns used for synchronous inter-service communication
 * over NestJS `Transport.TCP`.
 */
export const SERVICE_TCP_PATTERNS = {
  APP_HELLO: 'app.hello',
  APP_HEALTH: 'app.health',
  AUTH_REGISTER: 'auth.register',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_ME: 'auth.me',
  USERS_GET: 'users.get',
  USERS_UPDATE: 'users.update',
  ADMIN_USERS_LIST: 'admin.users.list',
  ADMIN_USERS_REVOKE_SESSIONS: 'admin.users.revokeSessions',
  DIALOGS_CREATE: 'dialogs.create',
  DIALOGS_LIST: 'dialogs.list',
  DIALOGS_MESSAGES_LIST: 'dialogs.messages.list',
  DIALOGS_MESSAGES_SEND: 'dialogs.messages.send',
  DIALOGS_MESSAGES_STREAM: 'dialogs.messages.stream',
  LLM_CHAT: 'llm.chat',
  LLM_CHAT_STREAM: 'llm.chat.stream',
} as const;

export type ServiceTcpPattern = (typeof SERVICE_TCP_PATTERNS)[keyof typeof SERVICE_TCP_PATTERNS];
