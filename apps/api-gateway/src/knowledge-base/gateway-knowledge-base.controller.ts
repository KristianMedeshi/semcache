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
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  DeleteKnowledgeDocumentResponseDto,
  KnowledgeDocumentDetailResponseDto,
  KnowledgeDocumentResponseDto,
  RetrieveKnowledgeContextResponseDto,
} from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { GatewayAccessPolicy } from '../auth/policies/gateway-access.policy';
import { ApiStandardErrors, ApiUuidParam } from '../common/swagger/api-responses.decorator';
import { SWAGGER_COOKIE_AUTH_NAME } from '../swagger';
import {
  DeleteKnowledgeDocumentResponseSwaggerDto,
  GatewayListKnowledgeDocumentsQueryDto,
  GatewayReprocessKnowledgeDocumentDto,
  GatewayRetrieveKnowledgeContextDto,
  GatewayUploadKnowledgeDocumentDto,
  KnowledgeDocumentDetailResponseSwaggerDto,
  KnowledgeDocumentResponseSwaggerDto,
  RetrieveKnowledgeContextResponseSwaggerDto,
} from './dto/gateway-knowledge-base.dto';
import { KnowledgeBaseProxyService } from './knowledge-base-proxy.service';

@ApiTags('Knowledge Base')
@ApiCookieAuth(SWAGGER_COOKIE_AUTH_NAME)
@Controller('knowledge-base')
export class GatewayKnowledgeBaseController {
  constructor(private readonly kbProxyService: KnowledgeBaseProxyService) {}

  @Can(GatewayAccessPolicy, 'manageKnowledgeBase')
  @Post('documents')
  @ApiOperation({ summary: 'Upload, chunk, and embed a new knowledge base document (admin only)' })
  @ApiCreatedResponse({
    description: 'Knowledge document ingested and indexed',
    type: KnowledgeDocumentDetailResponseSwaggerDto,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true })
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
  @ApiOperation({ summary: 'List knowledge base documents with optional category/status filters' })
  @ApiOkResponse({
    description: 'Knowledge document summaries',
    type: [KnowledgeDocumentResponseSwaggerDto],
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true })
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
  @ApiOperation({ summary: 'Get a knowledge base document with extracted content and chunks' })
  @ApiUuidParam('id', 'Knowledge document UUID')
  @ApiOkResponse({
    description: 'Detailed knowledge document',
    type: KnowledgeDocumentDetailResponseSwaggerDto,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
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
  @ApiOperation({
    summary:
      'Update/re-chunk/re-embed a knowledge base document and invalidate linked cache (admin only)',
  })
  @ApiUuidParam('id', 'Knowledge document UUID')
  @ApiOkResponse({
    description: 'Reprocessed knowledge document',
    type: KnowledgeDocumentDetailResponseSwaggerDto,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
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
  @ApiOperation({
    summary: 'Delete a knowledge base document and invalidate linked cache (admin only)',
  })
  @ApiUuidParam('id', 'Knowledge document UUID')
  @ApiOkResponse({
    description: 'Deleted document and chunk count',
    type: DeleteKnowledgeDocumentResponseSwaggerDto,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
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
  @ApiOperation({ summary: 'Perform semantic vector search over indexed knowledge base chunks' })
  @ApiOkResponse({
    description: 'Ranked knowledge chunks and formatted RAG context',
    type: RetrieveKnowledgeContextResponseSwaggerDto,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true })
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
