import type { ClientProxy } from '@nestjs/microservices';
import { createValidatedConfigService } from '@semcache/shared-config';
import { INTERNAL_AUTH_HEADERS, UserRole } from '@semcache/shared-types';
import { AuthProxyService } from '../auth/auth-proxy.service';
import { gatewayEnvSchema } from '../config/gateway.env';

export interface MockGatewayUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export function createTestGatewayUser(role: UserRole = UserRole.CUSTOMER): MockGatewayUser {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: role === UserRole.ADMIN ? 'admin@example.com' : 'alice@example.com',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function createGatewayAuthProxyMock(user: MockGatewayUser | null): AuthProxyService {
  const config = createValidatedConfigService(gatewayEnvSchema, { loadEnvFiles: false });
  const authClient = { send: jest.fn() } as unknown as ClientProxy;
  const authProxy = new AuthProxyService(config, authClient);
  jest.spyOn(authProxy, 'resolveCurrentUser').mockResolvedValue(user);
  return authProxy;
}

export function expectSignedInternalHeaders(
  sendMock: jest.Mock,
  expectedPattern: string,
  expectedUserId: string,
): void {
  expect(sendMock).toHaveBeenCalledTimes(1);
  const [pattern, payload] = sendMock.mock.calls[0] as unknown as [
    string,
    { headers: Record<string, string> },
  ];
  expect(pattern).toBe(expectedPattern);
  expect(payload.headers[INTERNAL_AUTH_HEADERS.USER_ID]).toBe(expectedUserId);
  expect(payload.headers[INTERNAL_AUTH_HEADERS.SIGNATURE]).toMatch(/^[a-f0-9]{64}$/);
}

export function useTestGatewayEnv(): void {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_SECRET = 'test-internal-service-secret-32-chars';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });
}
