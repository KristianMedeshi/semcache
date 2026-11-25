import { type AddressInfo, type Server } from 'node:net';
import { resolve } from 'node:path';
import type { INestMicroservice, Type } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  type MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { ServiceName, UserRole } from '@semcache/shared-types';
import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';
import { createSignedInternalHeaders } from './constants';

/**
 * Builds a Jest configuration for NestJS backend services using path aliases
 * resolved from the service's local `tsconfig.json`.
 */
export function createNestJestConfig(
  tsconfigDir: string = process.cwd(),
  overrides: Partial<Config> = {},
): Config {
  const { config: tsconfig } = ts.readConfigFile(
    resolve(tsconfigDir, 'tsconfig.json'),
    ts.sys.readFile,
  );
  const paths = tsconfig?.compilerOptions?.paths ?? {};

  return {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
      '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
    collectCoverageFrom: ['src/**/*.(t|j)s', 'libs/**/*.(t|j)s', 'apps/**/*.(t|j)s'],
    coverageDirectory: './coverage',
    testEnvironment: 'node',
    ...overrides,
  };
}

export interface TcpMicroserviceTestHarness {
  app: INestMicroservice;
  client: ClientProxy;
  port: number;
  close: () => Promise<void>;
}

/**
 * Starts a compiled `TestingModule` as an ephemeral TCP microservice on `127.0.0.1:0`
 * and connects a `ClientProxy` to it.
 */
export async function createTcpMicroserviceTestClient(
  moduleFixture: TestingModule,
): Promise<TcpMicroserviceTestHarness> {
  const app = moduleFixture.createNestMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 0 },
  });
  await app.listen();

  const address = app.unwrap<Server>().address() as AddressInfo;
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: address.port },
  });
  await client.connect();

  return {
    app,
    client,
    port: address.port,
    close: async () => {
      await client.close();
      await app.close();
    },
  };
}

/**
 * Builds HMAC-signed internal identity headers for microservice E2E tests.
 */
export function createE2eSignedHeaders(
  role: UserRole,
  sessionId: string,
  secret: string,
  userId = '11111111-1111-4111-8111-111111111111',
): Record<string, string> {
  return createSignedInternalHeaders(
    {
      id: userId,
      email: role === UserRole.ADMIN ? 'admin@example.com' : 'customer@example.com',
      role,
      sessionId,
    },
    secret,
  );
}

export interface HealthControllerLike {
  getHealth(): { service: string; status: string; timestamp: string };
}

/**
 * Shared Jest suite verifying a microservice's `AppController` health endpoint.
 */
export function describeServiceHealthController<TController extends HealthControllerLike>(
  controllerClass: Type<TController>,
  serviceClass: Type<unknown>,
  serviceName: ServiceName,
): void {
  describe('AppController', () => {
    let appController: TController;

    beforeEach(async () => {
      const app: TestingModule = await Test.createTestingModule({
        controllers: [controllerClass],
        providers: [serviceClass],
      }).compile();

      appController = app.get<TController>(controllerClass);
    });

    describe('health', () => {
      it('should return health status for the service', () => {
        const result = appController.getHealth();

        expect(result).toEqual({
          service: serviceName,
          status: 'ok',
          timestamp: expect.any(String),
        });
        expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
      });
    });
  });
}
