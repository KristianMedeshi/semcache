import type { AddressInfo, Server } from 'node:net';
import type { INestMicroservice } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  type MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { SERVICE_TCP_PATTERNS, ServiceName } from '@semcache/shared-types';
import { firstValueFrom } from 'rxjs';
import { AppModule } from '../src/app.module';

describe('AppController (TCP e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });
    await app.listen();

    const address = app.unwrap<Server>().address() as AddressInfo;
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: address.port },
    });
    await client.connect();
  });

  it('app.hello returns Hello World!', async () => {
    const res = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HELLO, {}));
    expect(res).toBe('Hello World!');
  });

  it('app.health returns service health status', async () => {
    const res = await firstValueFrom(client.send(SERVICE_TCP_PATTERNS.APP_HEALTH, {}));
    expect(res).toEqual({
      service: ServiceName.KNOWLEDGE_BASE_SERVICE,
      status: 'ok',
      timestamp: expect.any(String),
    });
  });

  afterEach(async () => {
    await client.close();
    await app.close();
  });
});
