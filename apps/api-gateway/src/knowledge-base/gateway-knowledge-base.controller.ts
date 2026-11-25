import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import type {
  DeleteKnowledgeDocumentResponseDto,
  KnowledgeDocumentDetailResponseDto,
  KnowledgeDocumentResponseDto,
  RetrieveKnowledgeContextResponseDto,
} from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { GatewayAccessPolicy } from '../auth/policies/gateway-access.policy';
import {
  GatewayListKnowledgeDocumentsQueryDto,
  GatewayReprocessKnowledgeDocumentDto,
  GatewayRetrieveKnowledgeContextDto,
  GatewayUploadKnowledgeDocumentDto,
} from './dto/gateway-knowledge-base.dto';
import { KnowledgeBaseProxyService } from './knowledge-base-proxy.service';

@Controller('knowledge-base')
export class GatewayKnowledgeBaseController {
  constructor(private readonly kbProxyService: KnowledgeBaseProxyService) {}

  @Can(GatewayAccessPolicy, 'manageKnowledgeBase')
  @Post('documents')
  async uploadDocument(
    @Body() body: GatewayUploadKnowledgeDocumentDto,
    @Headers('cookie') cookie?: string,
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    return this.kbProxyService.forwardKnowledgeBaseRequest<
      KnowledgeDocumentDetailResponseDto,
      GatewayUploadKnowledgeDocumentDto
    >(cookie, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_UPLOAD, { body });
  }

  @Can(GatewayAccessPolicy, 'readKnowledgeBase')
  @Get('documents')
  async listDocuments(
    @Query() query: GatewayListKnowledgeDocumentsQueryDto,
    @Headers('cookie') cookie?: string,
  ): Promise<KnowledgeDocumentResponseDto[]> {
    return this.kbProxyService.forwardKnowledgeBaseRequest<
      KnowledgeDocumentResponseDto[],
      GatewayListKnowledgeDocumentsQueryDto
    >(cookie, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST, { body: query });
  }

  @Can(GatewayAccessPolicy, 'readKnowledgeBase')
  @Get('documents/:id')
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('cookie') cookie?: string,
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    return this.kbProxyService.forwardKnowledgeBaseRequest<KnowledgeDocumentDetailResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_GET,
      { documentId: id },
    );
  }

  @Can(GatewayAccessPolicy, 'manageKnowledgeBase')
  @Post('documents/:id/reprocess')
  @HttpCode(HttpStatus.OK)
  async reprocessDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewayReprocessKnowledgeDocumentDto,
    @Headers('cookie') cookie?: string,
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    return this.kbProxyService.forwardKnowledgeBaseRequest<
      KnowledgeDocumentDetailResponseDto,
      GatewayReprocessKnowledgeDocumentDto
    >(cookie, SERVICE_TCP_PATTERNS.KB_DOCUMENTS_REPROCESS, { documentId: id, body });
  }

  @Can(GatewayAccessPolicy, 'manageKnowledgeBase')
  @Delete('documents/:id')
  async deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('cookie') cookie?: string,
  ): Promise<DeleteKnowledgeDocumentResponseDto> {
    return this.kbProxyService.forwardKnowledgeBaseRequest<DeleteKnowledgeDocumentResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_DELETE,
      { documentId: id },
    );
  }

  @Can(GatewayAccessPolicy, 'readKnowledgeBase')
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async searchKnowledgeBase(
    @Body() body: GatewayRetrieveKnowledgeContextDto,
    @Headers('cookie') cookie?: string,
  ): Promise<RetrieveKnowledgeContextResponseDto> {
    return this.kbProxyService.forwardKnowledgeBaseRequest<
      RetrieveKnowledgeContextResponseDto,
      GatewayRetrieveKnowledgeContextDto
    >(cookie, SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE, { body });
  }
}
