import { Module } from '@nestjs/common';
import { InternalIdentityAuth } from '../auth/internal-identity.provider';
import { DatabaseModule } from '../db/database.module';
import { SemanticCachePolicy } from '../policies/semantic-cache.policy';
import { SemanticCacheController } from './semantic-cache.controller';
import { SemanticCacheRepository } from './semantic-cache.repository';
import { SemanticCacheService } from './semantic-cache.service';
import { ThresholdCalculatorService } from './threshold-calculator.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SemanticCacheController],
  providers: [
    InternalIdentityAuth,
    SemanticCachePolicy,
    ThresholdCalculatorService,
    SemanticCacheRepository,
    SemanticCacheService,
  ],
  exports: [SemanticCacheService],
})
export class SemanticCacheModule {}
