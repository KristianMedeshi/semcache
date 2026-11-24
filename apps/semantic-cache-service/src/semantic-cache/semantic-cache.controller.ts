import { Controller } from '@nestjs/common';
import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {
  CacheInvalidationResponseDto,
  SemanticCacheEntryResponseDto,
  SemanticCacheLookupResponseDto,
  SemanticCacheSettingsResponseDto,
  SemanticCacheStatsResponseDto,
} from '@semcache/shared-dtos';
import { type AuthenticatedUser, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { SemanticCachePolicy } from '../policies/semantic-cache.policy';
import {
  InvalidateCacheByCategoryDto,
  InvalidateCacheBySourcesDto,
  SemanticCacheLookupDto,
  SemanticCacheStoreDto,
  UpdateSemanticCacheSettingsDto,
} from './dto/semantic-cache.dto';
import { SemanticCacheService } from './semantic-cache.service';

@Controller()
export class SemanticCacheController {
  constructor(private readonly semanticCacheService: SemanticCacheService) {}

  @Authenticate({ optional: true })
  @Can(SemanticCachePolicy, 'lookup')
  @MessagePattern(SERVICE_TCP_PATTERNS.CACHE_LOOKUP)
  async lookup(
    @Payload('body') dto: SemanticCacheLookupDto,
  ): Promise<SemanticCacheLookupResponseDto> {
    return this.semanticCacheService.lookup(dto);
  }

  @Authenticate({ optional: true })
  @Can(SemanticCachePolicy, 'store')
  @MessagePattern(SERVICE_TCP_PATTERNS.CACHE_STORE)
  async store(@Payload('body') dto: SemanticCacheStoreDto): Promise<SemanticCacheEntryResponseDto> {
    return this.semanticCacheService.store(dto);
  }

  @Can(SemanticCachePolicy, 'invalidate')
  @MessagePattern(SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES)
  async invalidateBySources(
    @Payload('body') dto: InvalidateCacheBySourcesDto,
  ): Promise<CacheInvalidationResponseDto> {
    return this.semanticCacheService.invalidateBySources(dto.documentIds);
  }

  @Can(SemanticCachePolicy, 'invalidate')
  @MessagePattern(SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_CATEGORY)
  async invalidateByCategory(
    @Payload('body') dto: InvalidateCacheByCategoryDto,
  ): Promise<CacheInvalidationResponseDto> {
    return this.semanticCacheService.invalidateByCategory(dto.category);
  }

  @Can(SemanticCachePolicy, 'invalidate')
  @MessagePattern(SERVICE_TCP_PATTERNS.CACHE_CLEAR_ALL)
  async clearAll(): Promise<CacheInvalidationResponseDto> {
    return this.semanticCacheService.clearAll();
  }

  @Can(SemanticCachePolicy, 'manageSettings')
  @MessagePattern(SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET)
  async getSettings(): Promise<SemanticCacheSettingsResponseDto> {
    return this.semanticCacheService.getSettings();
  }

  @Can(SemanticCachePolicy, 'manageSettings')
  @MessagePattern(SERVICE_TCP_PATTERNS.CACHE_SETTINGS_UPDATE)
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('body') dto: UpdateSemanticCacheSettingsDto,
  ): Promise<SemanticCacheSettingsResponseDto> {
    return this.semanticCacheService.updateSettings(dto, user.id);
  }

  @Can(SemanticCachePolicy, 'readStats')
  @MessagePattern(SERVICE_TCP_PATTERNS.CACHE_STATS_GET)
  async getStats(): Promise<SemanticCacheStatsResponseDto> {
    return this.semanticCacheService.getStats();
  }
}
