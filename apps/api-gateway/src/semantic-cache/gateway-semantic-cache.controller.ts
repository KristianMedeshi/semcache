import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import type {
  CacheInvalidationResponseDto,
  SemanticCacheSettingsResponseDto,
  SemanticCacheStatsResponseDto,
} from '@semcache/shared-dtos';
import { QueryCategory, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { GatewayAccessPolicy } from '../auth/policies/gateway-access.policy';
import {
  GatewayInvalidateCacheBySourcesDto,
  GatewayUpdateSemanticCacheSettingsDto,
} from './dto/gateway-semantic-cache.dto';
import { SemanticCacheProxyService } from './semantic-cache-proxy.service';

@Can(GatewayAccessPolicy, 'manageSemanticCache')
@Controller('admin/semantic-cache')
export class GatewaySemanticCacheController {
  constructor(private readonly semanticCacheProxyService: SemanticCacheProxyService) {}

  @Get('settings')
  async getSettings(@Headers('cookie') cookie?: string): Promise<SemanticCacheSettingsResponseDto> {
    return this.semanticCacheProxyService.forwardSemanticCacheRequest<SemanticCacheSettingsResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET,
    );
  }

  @Patch('settings')
  async updateSettings(
    @Body() body: GatewayUpdateSemanticCacheSettingsDto,
    @Headers('cookie') cookie?: string,
  ): Promise<SemanticCacheSettingsResponseDto> {
    return this.semanticCacheProxyService.forwardSemanticCacheRequest<
      SemanticCacheSettingsResponseDto,
      GatewayUpdateSemanticCacheSettingsDto
    >(cookie, SERVICE_TCP_PATTERNS.CACHE_SETTINGS_UPDATE, { body });
  }

  @Get('stats')
  async getStats(@Headers('cookie') cookie?: string): Promise<SemanticCacheStatsResponseDto> {
    return this.semanticCacheProxyService.forwardSemanticCacheRequest<SemanticCacheStatsResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.CACHE_STATS_GET,
    );
  }

  @Post('invalidate/sources')
  @HttpCode(HttpStatus.OK)
  async invalidateBySources(
    @Body() body: GatewayInvalidateCacheBySourcesDto,
    @Headers('cookie') cookie?: string,
  ): Promise<CacheInvalidationResponseDto> {
    return this.semanticCacheProxyService.forwardSemanticCacheRequest<
      CacheInvalidationResponseDto,
      GatewayInvalidateCacheBySourcesDto
    >(cookie, SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES, { body });
  }

  @Delete('entries/category/:category')
  async invalidateByCategory(
    @Param('category', new ParseEnumPipe(QueryCategory)) category: QueryCategory,
    @Headers('cookie') cookie?: string,
  ): Promise<CacheInvalidationResponseDto> {
    return this.semanticCacheProxyService.forwardSemanticCacheRequest<
      CacheInvalidationResponseDto,
      { category: QueryCategory }
    >(cookie, SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_CATEGORY, { body: { category } });
  }

  @Delete('entries')
  async clearAll(@Headers('cookie') cookie?: string): Promise<CacheInvalidationResponseDto> {
    return this.semanticCacheProxyService.forwardSemanticCacheRequest<CacheInvalidationResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.CACHE_CLEAR_ALL,
    );
  }
}
