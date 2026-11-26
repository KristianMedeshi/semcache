import { Controller } from '@nestjs/common';
import { Authenticate } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { GenerateEmbeddingsResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { GenerateEmbeddingsDto } from './dto/embeddings.dto';
import { EmbeddingService } from './embedding.service';
import { EmbeddingPolicy } from './policies/embedding.policy';

@Authenticate({ optional: true })
@Controller()
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Can(EmbeddingPolicy, 'generateEmbeddings')
  @MessagePattern(SERVICE_TCP_PATTERNS.EMBEDDINGS_GENERATE)
  async embed(@Payload() dto: GenerateEmbeddingsDto): Promise<GenerateEmbeddingsResponseDto> {
    return this.embeddingService.generateEmbeddings(dto);
  }
}
