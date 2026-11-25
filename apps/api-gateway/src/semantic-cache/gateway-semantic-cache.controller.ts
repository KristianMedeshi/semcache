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
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  CacheInvalidationResponseDto,
  SemanticCacheSettingsResponseDto,
  SemanticCacheStatsResponseDto,
} from '@semcache/shared-dtos';
import { QueryCategory, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { GatewayAccessPolicy } from '../auth/policies/gateway-access.policy';
import { ApiStandardErrors } from '../common/swagger/api-responses.decorator';
import { SWAGGER_COOKIE_AUTH_NAME } from '../swagger';
import {
  CacheInvalidationResponseSwaggerDto,
  GatewayInvalidateCacheBySourcesDto,
  GatewayUpdateSemanticCacheSettingsDto,
  SemanticCacheSettingsResponseSwaggerDto,
  SemanticCacheStatsResponseSwaggerDto,
} from './dto/gateway-semantic-cache.dto';
import { SemanticCacheProxyService } from './semantic-cache-proxy.service';

@ApiTags('Admin Semantic Cache')
@ApiCookieAuth(SWAGGER_COOKIE_AUTH_NAME)
@Can(GatewayAccessPolicy, 'manageSemanticCache')
@Controller('admin/semantic-cache')
export class GatewaySemanticCacheController {
  constructor(private readonly semanticCacheProxyService: SemanticCacheProxyService) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Get current semantic cache regime and adaptive threshold settings (admin only)',
  })
  @ApiOkResponse({
    description: 'Semantic cache settings',
    type: SemanticCacheSettingsResponseSwaggerDto,
  })
  @ApiStandardErrors({ auth: true, forbidden: true })
  async getSettings(@Headers('cookie') cookie?: string): Promise<SemanticCacheSettingsResponseDto> {
    return this.semanticCacheProxyService.forwardSemanticCacheRequest<SemanticCacheSettingsResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET,
    );
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Update semantic cache regime and adaptive threshold parameters (admin only)',
  })
  @ApiOkResponse({
    description: 'Updated semantic cache settings',
    type: SemanticCacheSettingsResponseSwaggerDto,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true })
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
  @ApiOperation({ summary: 'Get aggregate semantic cache entry and hit statistics (admin only)' })
  @ApiOkResponse({
    description: 'Semantic cache statistics',
    type: SemanticCacheStatsResponseSwaggerDto,
  })
  @ApiStandardErrors({ auth: true, forbidden: true })
  async getStats(@Headers('cookie') cookie?: string): Promise<SemanticCacheStatsResponseDto> {
    return this.semanticCacheProxyService.forwardSemanticCacheRequest<SemanticCacheStatsResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.CACHE_STATS_GET,
    );
  }

  @Post('invalidate/sources')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invalidate cached responses linked to specific knowledge document IDs (admin only)',
  })
  @ApiOkResponse({
    description: 'Cache invalidation result',
    type: CacheInvalidationResponseSwaggerDto,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true })
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
  @ApiOperation({
    summary: 'Invalidate cached responses for a specific query category (admin only)',
  })
  @ApiParam({ name: 'category', enum: QueryCategory, description: 'Target query category' })
  @ApiOkResponse({
    description: 'Cache invalidation result',
    type: CacheInvalidationResponseSwaggerDto,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true })
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
  @ApiOperation({ summary: 'Clear all semantic cache entries (admin only)' })
  @ApiOkResponse({
    description: 'Cache clear result',
    type: CacheInvalidationResponseSwaggerDto,
  })
  @ApiStandardErrors({ auth: true, forbidden: true })
  async clearAll(@Headers('cookie') cookie?: string): Promise<CacheInvalidationResponseDto> {
    return this.semanticCacheProxyService.forwardSemanticCacheRequest<CacheInvalidationResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.CACHE_CLEAR_ALL,
    );
  }
}
