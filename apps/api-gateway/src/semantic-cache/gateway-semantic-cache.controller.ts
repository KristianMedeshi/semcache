import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { QueryCategory, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
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
  async getSettings(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.semanticCacheProxyService.forwardSemanticCacheRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.CACHE_SETTINGS_GET,
      { statusCode: HttpStatus.OK },
    );
  }

  @Patch('settings')
  async updateSettings(
    @Body() body: GatewayUpdateSemanticCacheSettingsDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.semanticCacheProxyService.forwardSemanticCacheRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.CACHE_SETTINGS_UPDATE,
      { body, statusCode: HttpStatus.OK },
    );
  }

  @Get('stats')
  async getStats(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.semanticCacheProxyService.forwardSemanticCacheRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.CACHE_STATS_GET,
      { statusCode: HttpStatus.OK },
    );
  }

  @Post('invalidate/sources')
  async invalidateBySources(
    @Body() body: GatewayInvalidateCacheBySourcesDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.semanticCacheProxyService.forwardSemanticCacheRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_SOURCES,
      { body, statusCode: HttpStatus.OK },
    );
  }

  @Delete('entries/category/:category')
  async invalidateByCategory(
    @Param('category', new ParseEnumPipe(QueryCategory)) category: QueryCategory,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.semanticCacheProxyService.forwardSemanticCacheRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.CACHE_INVALIDATE_BY_CATEGORY,
      { body: { category }, statusCode: HttpStatus.OK },
    );
  }

  @Delete('entries')
  async clearAll(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.semanticCacheProxyService.forwardSemanticCacheRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.CACHE_CLEAR_ALL,
      { statusCode: HttpStatus.OK },
    );
  }
}
