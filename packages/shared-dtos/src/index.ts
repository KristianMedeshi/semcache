import {
  CacheHitStatus,
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
