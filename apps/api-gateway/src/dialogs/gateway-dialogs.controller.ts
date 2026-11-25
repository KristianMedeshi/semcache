import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { formatRpcErrorMessage } from '@semcache/shared-config';
import type {
  DeleteAllDialogsResponseDto,
  DeleteDialogResponseDto,
  DialogMessageResponseDto,
  DialogMessageStreamErrorEventDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { GatewayAccessPolicy } from '../auth/policies/gateway-access.policy';
import {
  ApiSseStreamResponse,
  ApiStandardErrors,
  ApiUuidParam,
} from '../common/swagger/api-responses.decorator';
import { SWAGGER_COOKIE_AUTH_NAME } from '../swagger';
import { DialogProxyService } from './dialog-proxy.service';
import {
  DeleteAllDialogsResponseSwaggerDto,
  DeleteDialogResponseSwaggerDto,
  DialogMessageResponseSwaggerDto,
  DialogResponseSwaggerDto,
  GatewayCreateDialogDto,
  GatewayEditMessageDto,
  GatewaySendMessageDto,
  GatewayUpdateDialogDto,
  SendMessageResponseSwaggerDto,
} from './dto/gateway-dialogs.dto';

const CACHE_TURN_HEADERS = {
  'X-Cache-Status': {
    description: 'Semantic cache outcome (HIT | MISS | BYPASS)',
    schema: { type: 'string' },
  },
  'X-Cache-Mode': { description: 'Active semantic cache mode', schema: { type: 'string' } },
} as const;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

@ApiTags('Dialogs')
@ApiCookieAuth(SWAGGER_COOKIE_AUTH_NAME)
@Can(GatewayAccessPolicy, 'accessDialogs')
@Controller('dialogs')
export class GatewayDialogsController {
  constructor(private readonly dialogProxyService: DialogProxyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new dialog conversation' })
  @ApiCreatedResponse({ description: 'Dialog created', type: DialogResponseSwaggerDto })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true })
  async createDialog(
    @Body() body: GatewayCreateDialogDto,
    @Headers('cookie') cookie?: string,
  ): Promise<DialogResponseDto> {
    const result = await this.dialogProxyService.forwardDialogRequest<
      DialogResponseDto,
      GatewayCreateDialogDto
    >(cookie, SERVICE_TCP_PATTERNS.DIALOGS_CREATE, { body });
    return result.data;
  }

  @Get()
  @ApiOperation({ summary: 'List all dialogs for the authenticated user' })
  @ApiOkResponse({ description: 'User dialog threads', type: [DialogResponseSwaggerDto] })
  @ApiStandardErrors({ auth: true, forbidden: true })
  async listDialogs(@Headers('cookie') cookie?: string): Promise<DialogResponseDto[]> {
    const result = await this.dialogProxyService.forwardDialogRequest<DialogResponseDto[]>(
      cookie,
      SERVICE_TCP_PATTERNS.DIALOGS_LIST,
    );
    return result.data;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename an existing dialog conversation' })
  @ApiUuidParam('id', 'Dialog UUID')
  @ApiOkResponse({ description: 'Updated dialog', type: DialogResponseSwaggerDto })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
  async updateDialog(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewayUpdateDialogDto,
    @Headers('cookie') cookie?: string,
  ): Promise<DialogResponseDto> {
    const result = await this.dialogProxyService.forwardDialogRequest<
      DialogResponseDto,
      GatewayUpdateDialogDto
    >(cookie, SERVICE_TCP_PATTERNS.DIALOGS_UPDATE, { dialogId: id, body });
    return result.data;
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all dialogs owned by the authenticated user' })
  @ApiOkResponse({ description: 'Deleted dialog count', type: DeleteAllDialogsResponseSwaggerDto })
  @ApiStandardErrors({ auth: true, forbidden: true })
  async deleteAllDialogs(@Headers('cookie') cookie?: string): Promise<DeleteAllDialogsResponseDto> {
    const result = await this.dialogProxyService.forwardDialogRequest<DeleteAllDialogsResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.DIALOGS_DELETE_ALL,
    );
    return result.data;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a dialog and all its messages' })
  @ApiUuidParam('id', 'Dialog UUID')
  @ApiOkResponse({ description: 'Dialog deleted', type: DeleteDialogResponseSwaggerDto })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
  async deleteDialog(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('cookie') cookie?: string,
  ): Promise<DeleteDialogResponseDto> {
    const result = await this.dialogProxyService.forwardDialogRequest<DeleteDialogResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.DIALOGS_DELETE,
      { dialogId: id },
    );
    return result.data;
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List all messages in a dialog thread' })
  @ApiUuidParam('id', 'Dialog UUID')
  @ApiOkResponse({
    description: 'Ordered dialog messages',
    type: [DialogMessageResponseSwaggerDto],
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('cookie') cookie?: string,
  ): Promise<DialogMessageResponseDto[]> {
    const result = await this.dialogProxyService.forwardDialogRequest<DialogMessageResponseDto[]>(
      cookie,
      SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_LIST,
      { dialogId: id },
    );
    return result.data;
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a user message and receive an assistant turn (with semantic cache & RAG)',
  })
  @ApiUuidParam('id', 'Dialog UUID')
  @ApiOkResponse({
    description: 'Completed dialog turn',
    type: SendMessageResponseSwaggerDto,
    headers: CACHE_TURN_HEADERS,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewaySendMessageDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('cookie') cookie?: string,
  ): Promise<SendMessageResponseDto> {
    return this.forwardTurn(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_SEND, res, cookie, {
      dialogId: id,
      body,
    });
  }

  @Post(':id/messages/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a user message and stream the assistant reply over SSE' })
  @ApiUuidParam('id', 'Dialog UUID')
  @ApiSseStreamResponse('Server-Sent Events stream of user_message, delta, done, and error events')
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
  async streamMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GatewaySendMessageDto,
    @Res() res: Response,
    @Headers('cookie') cookie?: string,
  ): Promise<void> {
    return this.streamTurn(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_STREAM, res, cookie, {
      dialogId: id,
      body,
    });
  }

  @Post(':id/messages/:messageId/edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit a user message to create a sibling conversation branch' })
  @ApiUuidParam('id', 'Dialog UUID')
  @ApiUuidParam('messageId', 'Target user message UUID')
  @ApiOkResponse({
    description: 'Completed branched turn',
    type: SendMessageResponseSwaggerDto,
    headers: CACHE_TURN_HEADERS,
  })
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
  async editMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() body: GatewayEditMessageDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('cookie') cookie?: string,
  ): Promise<SendMessageResponseDto> {
    return this.forwardTurn(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT, res, cookie, {
      dialogId: id,
      messageId,
      body,
    });
  }

  @Post(':id/messages/:messageId/edit/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit a user message and stream the branched assistant reply over SSE' })
  @ApiUuidParam('id', 'Dialog UUID')
  @ApiUuidParam('messageId', 'Target user message UUID')
  @ApiSseStreamResponse('Server-Sent Events stream for the branched turn')
  @ApiStandardErrors({ badRequest: true, auth: true, forbidden: true, notFound: true })
  async streamEditMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() body: GatewayEditMessageDto,
    @Res() res: Response,
    @Headers('cookie') cookie?: string,
  ): Promise<void> {
    return this.streamTurn(SERVICE_TCP_PATTERNS.DIALOGS_MESSAGES_EDIT_STREAM, res, cookie, {
      dialogId: id,
      messageId,
      body,
    });
  }

  private async forwardTurn<TBody>(
    pattern: string,
    res: Response,
    cookie: string | undefined,
    options: { dialogId: string; messageId?: string; body: TBody },
  ): Promise<SendMessageResponseDto> {
    const result = await this.dialogProxyService.forwardDialogRequest<
      SendMessageResponseDto,
      TBody
    >(cookie, pattern, options);
    this.applyCacheHeaders(res, result.cacheHeaders);
    return result.data;
  }

  private async streamTurn<TBody>(
    pattern: string,
    res: Response,
    cookie: string | undefined,
    options: { dialogId: string; messageId?: string; body: TBody },
  ): Promise<void> {
    const stream$ = await this.dialogProxyService.createDialogStream(cookie, pattern, options);
    await this.pipeSseResponse(res, stream$);
  }

  private applyCacheHeaders(
    res: Response,
    cacheHeaders?: { status?: string; mode?: string },
  ): void {
    if (cacheHeaders?.status) {
      res.setHeader('X-Cache-Status', cacheHeaders.status);
    }
    if (cacheHeaders?.mode) {
      res.setHeader('X-Cache-Mode', cacheHeaders.mode);
    }
  }

  private pipeSseResponse(
    res: Response,
    stream$: Observable<DialogMessageStreamEventDto>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let headersSent = false;
      let settled = false;

      const subscription = stream$.subscribe({
        next: (event) => {
          if (!headersSent) {
            headersSent = true;
            res.writeHead(HttpStatus.OK, SSE_HEADERS);
          }
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
        error: (error: unknown) => {
          const httpError =
            error instanceof HttpException
              ? error
              : new HttpException('Streaming error', HttpStatus.BAD_GATEWAY);
          if (!headersSent) {
            if (!settled) {
              settled = true;
              reject(httpError);
            }
            return;
          }

          const errorEvent: DialogMessageStreamErrorEventDto = {
            type: 'error',
            statusCode: httpError.getStatus(),
            message: formatRpcErrorMessage(
              { statusCode: httpError.getStatus(), message: httpError.message },
              'Streaming error',
            ),
          };
          res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
          res.end();
          if (!settled) {
            settled = true;
            resolve();
          }
        },
        complete: () => {
          if (!headersSent) {
            headersSent = true;
            res.writeHead(HttpStatus.OK, SSE_HEADERS);
          }
          res.end();
          if (!settled) {
            settled = true;
            resolve();
          }
        },
      });

      res.on('close', () => {
        subscription.unsubscribe();
        if (!settled) {
          settled = true;
          resolve();
        }
      });
    });
  }
}
