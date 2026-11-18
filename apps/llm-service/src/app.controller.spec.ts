import { Test, TestingModule } from '@nestjs/testing';
import { ServiceName } from '@semcache/shared-types';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return health status for the service', () => {
      const result = appController.getHealth();

      expect(result).toEqual({
        service: ServiceName.LLM_SERVICE,
        status: 'ok',
        timestamp: expect.any(String),
      });
      expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    });
  });
});
