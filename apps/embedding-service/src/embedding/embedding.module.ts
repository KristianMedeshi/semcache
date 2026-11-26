import { Module } from '@nestjs/common';
import { EmbeddingController } from './embedding.controller';
import { EmbeddingService } from './embedding.service';
import { EmbeddingPolicy } from './policies/embedding.policy';

@Module({
  controllers: [EmbeddingController],
  providers: [EmbeddingService, EmbeddingPolicy],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
