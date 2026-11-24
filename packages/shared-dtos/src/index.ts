import {
  CacheHitStatus,
  CacheMode,
  ChatMessageRole,
  HealthCheckStatus,
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
  SemanticEvaluationMetadata,
  UserRole,
} from '@semcache/shared-types';

/**
 * Standard REST API envelope for inter-service and client responses.
 */
export interface ApiResponseDto<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

/**
 * Standard REST API error response contract.
 */
export interface ApiErrorResponseDto {
  success: false;
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
}

/**
 * Shared validation limits and defaults for semantic cache operations and adaptive thresholds.
 */
export const SEMANTIC_CACHE_VALIDATION_LIMITS = {
  QUERY_MIN_LENGTH: 1,
  QUERY_MAX_LENGTH: 8_000,
  RESPONSE_MIN_LENGTH: 1,
  RESPONSE_MAX_LENGTH: 32_000,
  EMBEDDING_DIMENSIONS: 384,
  MIN_THRESHOLD: 0,
  MAX_THRESHOLD: 1,
  DEFAULT_FIXED_THRESHOLD: 0.9,
  DEFAULT_BASE_THRESHOLD: 0.85,
  DEFAULT_MIN_ADAPTIVE_THRESHOLD: 0.72,
  DEFAULT_MAX_ADAPTIVE_THRESHOLD: 0.97,
  DEFAULT_DENSITY_WEIGHT: 0.08,
  DEFAULT_DENSITY_K_NEIGHBORS: 5,
  MIN_DENSITY_K_NEIGHBORS: 1,
  MAX_DENSITY_K_NEIGHBORS: 50,
  MIN_DENSITY_WEIGHT: -0.5,
  MAX_DENSITY_WEIGHT: 0.5,
  MIN_CATEGORY_WEIGHT: -0.3,
  MAX_CATEGORY_WEIGHT: 0.3,
  MAX_SOURCE_IDS_PER_ENTRY: 50,
} as const;

/**
 * Default per-category adaptive threshold offsets for telecom customer support queries.
 */
export const DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS: Record<QueryCategory, number> = {
  [QueryCategory.BILLING]: 0.05,
  [QueryCategory.ACCOUNT_MANAGEMENT]: 0.04,
  [QueryCategory.TECHNICAL_SUPPORT]: 0.01,
  [QueryCategory.PRODUCT_INQUIRY]: -0.02,
  [QueryCategory.GENERAL]: -0.03,
};

/**
 * Reference to a Knowledge Base document/chunk linked to a cached response.
 */
export interface CacheKnowledgeSourceReferenceDto {
  documentId: string;
  documentTitle?: string;
  chunkId?: string;
  chunkIndex?: number;
}

/**
 * DTO contract for semantic cache lookup request between Dialog/Gateway and Semantic Cache Service.
 */
export interface SemanticCacheLookupRequestDto {
  query: string;
  embedding?: number[];
  category?: QueryCategory;
  sessionId?: string;
  mode?: CacheMode;
  fixedThresholdOverride?: number;
}

/**
 * Compact semantic cache telemetry attached to dialog turn responses.
 */
export interface SemanticCacheTurnMetadataDto {
  status: CacheHitStatus;
  mode: CacheMode;
  entryId?: string;
  matchedQuery?: string;
  cosineSimilarity: number;
  adaptiveThreshold: number;
  localClusterDensity?: number;
  neighborCount?: number;
  category: QueryCategory;
  knowledgeSourceIds?: string[];
}

/**
 * DTO contract for semantic cache lookup response.
 */
export interface SemanticCacheLookupResponseDto {
  status: CacheHitStatus;
  mode: CacheMode;
  entryId?: string;
  cachedResponse?: string;
  matchedQuery?: string;
  knowledgeSourceIds?: string[];
  knowledgeSources?: CacheKnowledgeSourceReferenceDto[];
  evaluation: SemanticEvaluationMetadata;
}

/**
 * DTO contract for storing a query-response pair in the semantic cache.
 */
export interface SemanticCacheStoreRequestDto {
  query: string;
  response: string;
  embedding: number[];
  category?: QueryCategory;
  knowledgeSourceIds?: string[];
  knowledgeSources?: CacheKnowledgeSourceReferenceDto[];
  model?: string;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * DTO representing a persisted semantic cache entry.
 */
export interface SemanticCacheEntryResponseDto {
  id: string;
  query: string;
  response: string;
  category: QueryCategory;
  model: string | null;
  hitCount: number;
  lastHitAt: string | null;
  knowledgeSourceIds: string[];
  knowledgeSources: CacheKnowledgeSourceReferenceDto[];
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO contract for invalidating cached entries linked to updated Knowledge Base documents.
 */
export interface InvalidateCacheBySourcesRequestDto {
  documentIds: string[];
}

/**
 * DTO contract for clearing cached entries in a specific intent category.
 */
export interface InvalidateCacheByCategoryRequestDto {
  category: QueryCategory;
}

export type CacheInvalidationScope = 'sources' | 'category' | 'all';

/**
 * DTO returned after invalidating or clearing semantic cache entries.
 */
export interface CacheInvalidationResponseDto {
  invalidatedCount: number;
  scope: CacheInvalidationScope;
  category?: QueryCategory;
  documentIds?: string[];
}

export type SemanticCacheCategoryWeightsDto = Record<QueryCategory, number>;

/**
 * Persisted semantic cache regime and adaptive threshold configuration.
 */
export interface SemanticCacheSettingsResponseDto {
  id: string;
  mode: CacheMode;
  fixedThreshold: number;
  adaptiveBaseThreshold: number;
  minAdaptiveThreshold: number;
  maxAdaptiveThreshold: number;
  densityWeight: number;
  densityKNeighbors: number;
  categoryWeights: SemanticCacheCategoryWeightsDto;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Partial update payload for semantic cache settings.
 */
export interface UpdateSemanticCacheSettingsRequestDto {
  mode?: CacheMode;
  fixedThreshold?: number;
  adaptiveBaseThreshold?: number;
  minAdaptiveThreshold?: number;
  maxAdaptiveThreshold?: number;
  densityWeight?: number;
  densityKNeighbors?: number;
  categoryWeights?: Partial<SemanticCacheCategoryWeightsDto>;
}

/**
 * Per-category entry count and hit summary.
 */
export interface SemanticCacheCategoryStatsDto {
  category: QueryCategory;
  entryCount: number;
  totalHits: number;
}

/**
 * Aggregate operational statistics for the semantic cache.
 */
export interface SemanticCacheStatsResponseDto {
  mode: CacheMode;
  totalEntries: number;
  totalHits: number;
  byCategory: SemanticCacheCategoryStatsDto[];
}

/**
 * TCP RPC request envelope forwarded to `semantic-cache-service`.
 */
export interface SemanticCacheTcpRequestDto<TBody = undefined> {
  headers?: Record<string, string>;
  category?: QueryCategory;
  body?: TBody;
}

export type HealthCheckResponseDto = HealthCheckStatus;

/**
 * Shared validation constraints for authentication and user profile payloads.
 */
export const AUTH_VALIDATION_LIMITS = {
  EMAIL_MAX_LENGTH: 255,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_LOGIN_MIN_LENGTH: 1,
  PASSWORD_MAX_LENGTH: 128,
} as const;

/**
 * Password complexity pattern requiring lowercase, uppercase, and digit or special character (8-128 chars).
 */
export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{8,128}$/;

/**
 * Standard validation error message for password complexity failures.
 */
export const PASSWORD_COMPLEXITY_MESSAGE =
  'Password must be 8-128 characters and include uppercase, lowercase, and a number or special character';

/**
 * DTO contract for customer registration.
 */
export interface RegisterRequestDto {
  email: string;
  password: string;
}

/**
 * DTO contract for email/password authentication.
 */
export interface LoginRequestDto {
  email: string;
  password: string;
}

/**
 * DTO contract for updating a user's own profile (excluding role).
 */
export interface UpdateUserProfileRequestDto {
  email?: string;
  password?: string;
}

/**
 * Sanitized user profile DTO returned across REST endpoints (never includes passwordHash).
 */
export interface UserResponseDto {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO returned when terminating the current session.
 */
export interface LogoutResponseDto {
  success: true;
}

/**
 * DTO returned when revoking all active sessions for a target user.
 */
export interface RevokeUserSessionsResponseDto {
  revokedCount: number;
}

/**
 * Shared validation limits for dialogs, messages, and LLM requests.
 */
export const DIALOG_VALIDATION_LIMITS = {
  TITLE_MAX_LENGTH: 120,
  MESSAGE_MIN_LENGTH: 1,
  MESSAGE_MAX_LENGTH: 8000,
  MODEL_MAX_LENGTH: 120,
} as const;

/**
 * Regex matching permitted zero-cost OpenRouter models (`openrouter/free` or `<provider>/<model>:free`).
 */
export const FREE_OPENROUTER_MODEL_REGEX =
  /^(openrouter\/free|[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+:free)$/;

/**
 * Validation message returned when a non-free OpenRouter model is requested.
 */
export const FREE_OPENROUTER_MODEL_MESSAGE =
  'Only free OpenRouter models (openrouter/free or <provider>/<model>:free) are allowed';

/**
 * Regex matching permitted LLM models: zero-cost OpenRouter models (`openrouter/free`, `*:free`)
 * plus explicit local/LM Studio models (`support-llm`, `qwen/qwen3-1.7b`, `local/*`, `*:local`).
 */
export const ALLOWED_LLM_MODEL_REGEX =
  /^(openrouter\/free|[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+:free|support-llm|qwen\/qwen3-1\.7b|local\/[a-zA-Z0-9._/-]+|[a-zA-Z0-9._/-]+:local|onnx-community\/[a-zA-Z0-9._/-]+|Xenova\/[a-zA-Z0-9._/-]+)$/;

/**
 * Validation message returned when an unsupported model identifier is requested.
 */
export const ALLOWED_LLM_MODEL_MESSAGE =
  'Only free OpenRouter models (openrouter/free or <provider>/<model>:free) or permitted local models (support-llm, qwen/qwen3-1.7b, onnx-community/*, Xenova/*, local/*, *:local) are allowed';

/**
 * Single message passed to `llm-service` for chat completion.
 */
export interface LlmChatMessageDto {
  role: ChatMessageRole;
  content: string;
}

/**
 * DTO contract for `POST /llm/chat` requests from `dialog-service` to `llm-service`.
 */
export interface LlmChatCompletionRequestDto {
  messages: LlmChatMessageDto[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Token accounting returned by `llm-service` and persisted by `dialog-service`.
 */
export interface LlmTokenUsageDto {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * DTO contract for `POST /llm/chat` responses returned by `llm-service`.
 */
export interface LlmChatCompletionResponseDto {
  content: string;
  model: string;
  latencyMs: number;
  usage: LlmTokenUsageDto;
}

/**
 * Text delta chunk emitted by `llm-service` over `llm.chat.stream`.
 */
export interface LlmChatStreamDeltaEventDto {
  type: 'delta';
  delta: string;
}

/**
 * Final completion event emitted by `llm-service` over `llm.chat.stream`.
 */
export interface LlmChatStreamDoneEventDto {
  type: 'done';
  completion: LlmChatCompletionResponseDto;
}

/**
 * Union of stream events emitted by `llm-service` on `llm.chat.stream`.
 */
export type LlmChatStreamEventDto = LlmChatStreamDeltaEventDto | LlmChatStreamDoneEventDto;

/**
 * DTO contract for creating a new dialog conversation.
 */
export interface CreateDialogRequestDto {
  title?: string;
}

/**
 * DTO contract for updating an existing dialog conversation's title.
 */
export interface UpdateDialogRequestDto {
  title: string;
}

/**
 * DTO returned after deleting a dialog conversation.
 */
export interface DeleteDialogResponseDto {
  id: string;
  deleted: true;
}

/**
 * DTO returned after deleting all dialog conversations for a user.
 */
export interface DeleteAllDialogsResponseDto {
  deletedCount: number;
  deleted: true;
}

/**
 * DTO representing a user dialog thread.
 */
export interface DialogResponseDto {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO representing a persisted message inside a dialog thread.
 */
export interface DialogMessageResponseDto {
  id: string;
  dialogId: string;
  parentMessageId?: string | null;
  role: ChatMessageRole;
  content: string;
  model: string | null;
  latencyMs: number | null;
  usage: LlmTokenUsageDto | null;
  createdAt: string;
}

/**
 * DTO contract for sending a user message inside a dialog.
 */
export interface SendMessageRequestDto {
  content: string;
  model?: string;
  parentMessageId?: string | null;
  category?: QueryCategory;
  cacheMode?: CacheMode;
  fixedThresholdOverride?: number;
}

/**
 * DTO contract for editing an existing user message to create a new conversation branch.
 */
export interface EditMessageRequestDto {
  content: string;
  model?: string;
}

/**
 * DTO contract returned after completing a chat turn (`userMessage` + `assistantMessage`).
 */
export interface SendMessageResponseDto {
  dialog: DialogResponseDto;
  userMessage: DialogMessageResponseDto;
  assistantMessage: DialogMessageResponseDto;
  cache?: SemanticCacheTurnMetadataDto;
}

/**
 * Persisted user message event emitted at the start of `dialogs.messages.stream`.
 */
export interface DialogMessageStreamUserMessageEventDto {
  type: 'user_message';
  userMessage: DialogMessageResponseDto;
}

/**
 * Assistant response text delta event emitted during `dialogs.messages.stream`.
 */
export interface DialogMessageStreamDeltaEventDto {
  type: 'delta';
  delta: string;
}

/**
 * Final completion event emitted when `dialogs.messages.stream` finishes persisting the turn.
 */
export interface DialogMessageStreamDoneEventDto {
  type: 'done';
  dialog: DialogResponseDto;
  userMessage: DialogMessageResponseDto;
  assistantMessage: DialogMessageResponseDto;
  cache?: SemanticCacheTurnMetadataDto;
}

/**
 * Error event emitted as SSE when a failure occurs after streaming headers are sent.
 */
export interface DialogMessageStreamErrorEventDto {
  type: 'error';
  statusCode: number;
  message: string;
}

/**
 * Union of stream events emitted by `dialog-service` (`dialogs.messages.stream`) and `api-gateway` SSE.
 */
export type DialogMessageStreamEventDto =
  | DialogMessageStreamUserMessageEventDto
  | DialogMessageStreamDeltaEventDto
  | DialogMessageStreamDoneEventDto
  | DialogMessageStreamErrorEventDto;

/**
 * Structured RPC error payload serialized over NestJS TCP transport.
 */
export interface RpcErrorPayloadDto {
  statusCode: number;
  message: string | string[];
  error?: string;
  errorCode?: string;
}

/**
 * TCP RPC request envelope forwarded from `api-gateway` to `auth-service`.
 */
export interface AuthTcpRequestDto<TBody = undefined> {
  body?: TBody;
  id?: string;
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  ip?: string;
}

/**
 * TCP RPC response envelope returned by `auth-service` when setting or clearing cookies.
 */
export interface AuthTcpResponseDto<TData> {
  data: TData;
  setCookie?: string;
}

/**
 * TCP RPC request envelope forwarded from `api-gateway` to `dialog-service`.
 */
export interface DialogTcpRequestDto<TBody = undefined> {
  headers: Record<string, string>;
  dialogId?: string;
  messageId?: string;
  body?: TBody;
}

/**
 * Shared validation and chunking limits for Knowledge Base documents and RAG retrieval.
 */
export const KNOWLEDGE_BASE_VALIDATION_LIMITS = {
  TITLE_MAX_LENGTH: 200,
  FILENAME_MAX_LENGTH: 255,
  CONTENT_MIN_LENGTH: 1,
  CONTENT_MAX_LENGTH: 500_000,
  QUERY_MIN_LENGTH: 1,
  QUERY_MAX_LENGTH: 4_000,
  DEFAULT_CHUNK_SIZE: 800,
  MIN_CHUNK_SIZE: 100,
  MAX_CHUNK_SIZE: 4_000,
  DEFAULT_CHUNK_OVERLAP: 150,
  MAX_CHUNK_OVERLAP: 1_000,
  DEFAULT_TOP_K: 4,
  MIN_TOP_K: 1,
  MAX_TOP_K: 20,
  DEFAULT_MIN_SIMILARITY: 0.25,
  EMBEDDING_DIMENSIONS: 384,
  MAX_EMBEDDING_BATCH_SIZE: 128,
} as const;

/**
 * DTO contract for requesting embedding vectors from `llm-service` (`llm.embeddings`).
 */
export interface LlmGenerateEmbeddingsRequestDto {
  texts: string[];
  model?: string;
}

/**
 * DTO contract for embedding vectors returned by `llm-service`.
 */
export interface LlmGenerateEmbeddingsResponseDto {
  embeddings: number[][];
  model: string;
  dimensions: number;
  latencyMs: number;
  usage: {
    totalTokens: number;
  };
}

/**
 * DTO contract for uploading a knowledge base document.
 */
export interface UploadKnowledgeDocumentRequestDto {
  title: string;
  content: string;
  fileName?: string;
  format?: KnowledgeDocumentFormat;
  category?: QueryCategory;
  metadata?: Record<string, string | number | boolean>;
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * DTO contract for reprocessing (and optionally updating) an existing knowledge base document.
 */
export interface ReprocessKnowledgeDocumentRequestDto {
  content?: string;
  title?: string;
  metadata?: Record<string, string | number | boolean>;
  chunkSize?: number;
  chunkOverlap?: number;
  includeChunks?: boolean;
}

/**
 * DTO representing a knowledge base document summary and processing status.
 */
export interface KnowledgeDocumentResponseDto {
  id: string;
  title: string;
  fileName: string | null;
  format: KnowledgeDocumentFormat;
  category: QueryCategory;
  status: KnowledgeDocumentStatus;
  chunkCount: number;
  characterCount: number;
  errorMessage: string | null;
  metadata: Record<string, string | number | boolean>;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO representing a single processed chunk of a knowledge base document.
 */
export interface KnowledgeChunkResponseDto {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  characterCount: number;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

/**
 * Detailed knowledge base document DTO including extracted content and chunks.
 */
export interface KnowledgeDocumentDetailResponseDto extends KnowledgeDocumentResponseDto {
  content: string;
  chunks?: KnowledgeChunkResponseDto[];
}

/**
 * DTO returned after deleting a knowledge base document and its chunks.
 */
export interface DeleteKnowledgeDocumentResponseDto {
  id: string;
  deleted: true;
  deletedChunksCount: number;
}

/**
 * DTO contract for querying knowledge base documents via semantic similarity search.
 */
export interface RetrieveKnowledgeContextRequestDto {
  query: string;
  topK?: number;
  minSimilarity?: number;
  category?: QueryCategory;
}

/**
 * Source document reference attached to retrieved knowledge base chunks.
 */
export interface KnowledgeContextSourceReferenceDto {
  documentId: string;
  documentTitle: string;
  fileName: string | null;
  category: QueryCategory;
  chunkId: string;
  chunkIndex: number;
}

/**
 * Single ranked knowledge chunk returned by semantic similarity search.
 */
export interface RetrievedKnowledgeChunkDto {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  fileName: string | null;
  category: QueryCategory;
  chunkIndex: number;
  content: string;
  similarity: number;
  source: KnowledgeContextSourceReferenceDto;
}

/**
 * DTO contract returned by `kb.context.retrieve` and `POST /knowledge-base/search`.
 */
export interface RetrieveKnowledgeContextResponseDto {
  query: string;
  hasRelevantContext: boolean;
  formattedContext: string;
  results: RetrievedKnowledgeChunkDto[];
  sources: KnowledgeContextSourceReferenceDto[];
}

/**
 * Filter parameters for listing knowledge base documents.
 */
export interface ListKnowledgeDocumentsQueryDto {
  category?: QueryCategory;
  status?: KnowledgeDocumentStatus;
}

/**
 * TCP RPC request envelope forwarded to `knowledge-base-service`.
 */
export interface KnowledgeBaseTcpRequestDto<TBody = undefined> {
  headers?: Record<string, string>;
  documentId?: string;
  body?: TBody;
}
