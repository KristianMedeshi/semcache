import {
  CacheHitStatus,
  ChatMessageRole,
  HealthCheckStatus,
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
 * DTO contract for semantic cache lookup request between Dialog/Gateway and Semantic Cache Service.
 */
export interface SemanticCacheLookupRequestDto {
  query: string;
  category?: QueryCategory;
  sessionId?: string;
}

/**
 * DTO contract for semantic cache lookup response.
 */
export interface SemanticCacheLookupResponseDto {
  status: CacheHitStatus;
  cachedResponse?: string;
  evaluation?: SemanticEvaluationMetadata;
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
 * DTO contract for creating a new dialog conversation.
 */
export interface CreateDialogRequestDto {
  title?: string;
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
}

/**
 * DTO contract returned after completing a chat turn (`userMessage` + `assistantMessage`).
 */
export interface SendMessageResponseDto {
  dialog: DialogResponseDto;
  userMessage: DialogMessageResponseDto;
  assistantMessage: DialogMessageResponseDto;
}
