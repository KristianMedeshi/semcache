import type {
  LoginRequestDto,
  LogoutResponseDto,
  RegisterRequestDto,
  RevokeUserSessionsResponseDto,
  UpdateUserProfileRequestDto,
  UserResponseDto,
} from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { ApiError, apiClient } from '@/lib/api-client';

export { ApiError as AuthApiError };

export async function registerCustomer(dto: RegisterRequestDto): Promise<UserResponseDto> {
  const { data } = await apiClient.post<UserResponseDto>('/auth/register', dto);
  return data;
}

export async function login(dto: LoginRequestDto): Promise<UserResponseDto> {
  const { data } = await apiClient.post<UserResponseDto>('/auth/login', dto);
  return data;
}

export async function logout(): Promise<LogoutResponseDto> {
  const { data } = await apiClient.post<LogoutResponseDto>('/auth/logout');
  return data;
}

/**
 * Fetches the authenticated user using the browser's HttpOnly session cookie.
 * Returns `null` when unauthenticated or when the session has expired (HTTP 401).
 */
export async function getCurrentUser(): Promise<UserResponseDto | null> {
  try {
    const { data } = await apiClient.get<UserResponseDto>('/auth/me');
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      return null;
    }
    throw error;
  }
}

export async function getUserProfile(userId: string): Promise<UserResponseDto> {
  const { data } = await apiClient.get<UserResponseDto>(`/users/${encodeURIComponent(userId)}`);
  return data;
}

export async function updateUserProfile(
  userId: string,
  dto: UpdateUserProfileRequestDto,
): Promise<UserResponseDto> {
  const { data } = await apiClient.patch<UserResponseDto>(
    `/users/${encodeURIComponent(userId)}`,
    dto,
  );
  return data;
}

export async function listUsers(): Promise<UserResponseDto[]> {
  const { data } = await apiClient.get<UserResponseDto[]>('/admin/users');
  return data;
}

export async function revokeUserSessions(userId: string): Promise<RevokeUserSessionsResponseDto> {
  const { data } = await apiClient.delete<RevokeUserSessionsResponseDto>(
    `/admin/users/${encodeURIComponent(userId)}/sessions`,
  );
  return data;
}

export function isCustomer(user: UserResponseDto | null): boolean {
  return user?.role === UserRole.CUSTOMER;
}

export function isAdmin(user: UserResponseDto | null): boolean {
  return user?.role === UserRole.ADMIN;
}
