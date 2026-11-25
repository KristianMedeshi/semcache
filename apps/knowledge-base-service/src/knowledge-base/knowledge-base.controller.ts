import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {
  DeleteKnowledgeDocumentResponseDto,
  KnowledgeDocumentDetailResponseDto,
  KnowledgeDocumentResponseDto,
  RetrieveKnowledgeContextResponseDto,
} from '@semcache/shared-dtos';
import { type AuthenticatedUser, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { KnowledgeBasePolicy } from '../policies/knowledge-base.policy';
import {
  ListKnowledgeDocumentsDto,
  ReprocessKnowledgeDocumentDto,
  RetrieveKnowledgeContextDto,
  UploadKnowledgeDocumentDto,
} from './dto/knowledge-base.dto';
import { KnowledgeBaseService } from './knowledge-base.service';

@Controller()
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Can(KnowledgeBasePolicy, 'manageDocuments')
  @MessagePattern(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_UPLOAD)
  async uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Payload('body') dto: UploadKnowledgeDocumentDto,
    @Payload('headers') headers?: Record<string, string>,
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    return this.knowledgeBaseService.uploadDocument(dto, user.id, headers);
  }

  @Can(KnowledgeBasePolicy, 'readDocument')
  @MessagePattern(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST)
  async listDocuments(
    @Payload('body') filters?: ListKnowledgeDocumentsDto,
  ): Promise<KnowledgeDocumentResponseDto[]> {
    return this.knowledgeBaseService.listDocuments(filters);
  }

  @Can(KnowledgeBasePolicy, 'readDocument')
  @MessagePattern(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_GET)
  async getDocument(
    @Payload('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    return this.knowledgeBaseService.getDocument(documentId, true);
  }

  @Can(KnowledgeBasePolicy, 'manageDocuments')
  @MessagePattern(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_DELETE)
  async deleteDocument(
    @Payload('documentId', ParseUUIDPipe) documentId: string,
    @Payload('headers') headers?: Record<string, string>,
  ): Promise<DeleteKnowledgeDocumentResponseDto> {
    return this.knowledgeBaseService.deleteDocument(documentId, headers);
  }

  @Can(KnowledgeBasePolicy, 'manageDocuments')
  @MessagePattern(SERVICE_TCP_PATTERNS.KB_DOCUMENTS_REPROCESS)
  async reprocessDocument(
    @Payload('documentId', ParseUUIDPipe) documentId: string,
    @Payload('body') dto?: ReprocessKnowledgeDocumentDto,
    @Payload('headers') headers?: Record<string, string>,
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    return this.knowledgeBaseService.reprocessDocument(documentId, dto, headers);
  }

  @Authenticate({ optional: true })
  @Can(KnowledgeBasePolicy, 'retrieveContext')
  @MessagePattern(SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE)
  async retrieveContext(
    @Payload('body') dto: RetrieveKnowledgeContextDto,
  ): Promise<RetrieveKnowledgeContextResponseDto> {
    return this.knowledgeBaseService.retrieveContext(dto);
  }
}
