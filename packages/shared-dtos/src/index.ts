import {
  CacheHitStatus,
  HealthCheckStatus,
  QueryCategory,
  SemanticEvaluationMetadata,
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
