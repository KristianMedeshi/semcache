import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Request, Response } from 'express';
import { GatewayAccessPolicy } from '../auth/policies/gateway-access.policy';
import {
  GatewayListKnowledgeDocumentsQueryDto,
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
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.kbProxyService.forwardKnowledgeBaseRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_UPLOAD,
      {
        body,
        statusCode: HttpStatus.CREATED,
      },
    );
  }

  @Can(GatewayAccessPolicy, 'readKnowledgeBase')
  @Get('documents')
  async listDocuments(
    @Query() query: GatewayListKnowledgeDocumentsQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.kbProxyService.forwardKnowledgeBaseRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_LIST,
      {
        body: query,
        statusCode: HttpStatus.OK,
      },
    );
  }

  @Can(GatewayAccessPolicy, 'readKnowledgeBase')
  @Get('documents/:id')
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.kbProxyService.forwardKnowledgeBaseRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_GET,
      {
        documentId: id,
        statusCode: HttpStatus.OK,
      },
    );
  }

  @Can(GatewayAccessPolicy, 'manageKnowledgeBase')
  @Post('documents/:id/reprocess')
  async reprocessDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.kbProxyService.forwardKnowledgeBaseRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_REPROCESS,
      {
        documentId: id,
        body: {},
        statusCode: HttpStatus.OK,
      },
    );
  }

  @Can(GatewayAccessPolicy, 'manageKnowledgeBase')
  @Delete('documents/:id')
  async deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.kbProxyService.forwardKnowledgeBaseRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.KB_DOCUMENTS_DELETE,
      {
        documentId: id,
        statusCode: HttpStatus.OK,
      },
    );
  }

  @Can(GatewayAccessPolicy, 'readKnowledgeBase')
  @Post('search')
  async searchKnowledgeBase(
    @Body() body: GatewayRetrieveKnowledgeContextDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.kbProxyService.forwardKnowledgeBaseRequest(
      req,
      res,
      SERVICE_TCP_PATTERNS.KB_CONTEXT_RETRIEVE,
      {
        body,
        statusCode: HttpStatus.OK,
      },
    );
  }
}
